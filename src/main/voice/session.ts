import { ROBOT_PITCH } from '../../shared/api'
import { isReplying, sendMessage, stopChat, type ReplyResult } from '../ai/chat'
import { transcribeAudio } from '../ai/speech'
import { createConversation } from '../data/conversations'
import { DEFAULT_ENDPOINTER, Endpointer } from '../lib/endpointer'
import { SentenceSplitter } from '../lib/sentences'
import { isStopRequest, parseConfirmation } from '../lib/voiceCommands'
import { getSettings } from '../settings'
import { BrowserWindow } from 'electron'
import { getMainWindow } from '../system/window'
import { isApprovalPending, onApprovalRequested, respondToApproval } from '../tools/approval'
import {
  disposeVoiceEngines,
  getPiper,
  getVad,
  getVoicePaths,
  getWakeWordDetector,
  getWhisper,
  isLocalSttReady,
  isPiperReady
} from './engines'
import { VAD_FRAME_SAMPLES } from './vad'
import { WAKE_CHUNK_SAMPLES } from './wakeword'
import { plainForSpeech } from '../../shared/speechText'
import { encodeWav, normalizeGain } from '../../shared/wav'
import type { VoiceEvent, VoicePhase, VoiceState } from '../../shared/api'
import { requestMemoryProcessing } from '../scheduler/memory'

// Sesli sohbet: "hey jarvis" → dinle → yazıya çevir → asistana sor → cümle cümle seslendir → yeniden dinle.
// Mikrofon sesi arayüzden 80 ms'lik parçalar halinde gelir; bütün kararlar burada verilir.

// Arayüzden gelen ses birikirse (işlem yetişemezse) en fazla bu kadar parça tutulur (~2 sn)
const MAX_QUEUED_CHUNKS = 25
// Sohbet bittikten hemen sonra aynı cümlenin kuyruğu yeniden uyandırmasın
const WAKE_COOLDOWN_MS = 1500
// Söz kesme: Pıtır konuşurken bu olasılığın üstünde bu kadar süre konuşma duyulursa susulur
const BARGE_IN_PROBABILITY = 0.9
const BARGE_IN_MS = 500
// Söz kesilince konuşmanın başı kaybolmasın diye son ~0,5 sn saklanır
const RECENT_FRAMES = 16
// Arka arkaya bu kadar "anlaşılamadı" olursa sohbet bitirilir
const MAX_MISUNDERSTOOD = 2
// Seslendirme bitti haberi gelmezse (ör. arayüz yenilendi) bu süre sonra bitmiş sayılır
const PLAYBACK_GRACE_MS = 8000
const MAX_SPEAK_TEXT = 3000
const FRAME_MS = (VAD_FRAME_SAMPLES / 16000) * 1000

let phase: VoicePhase = 'off'
let sessionActive = false
let conversationId: number | null = null
let pendingApprovalId: string | null = null
let misunderstood = 0
let wakeCooldownUntil = 0

const endpointer = new Endpointer(DEFAULT_ENDPOINTER)
let vadNeedsReset = true
let remainder = new Float32Array(0)
let recentFrames: Float32Array[] = []
let bargeRun = 0

const queue: Float32Array[] = []
let draining = false

// Seslendirme durumu. generation her iptalde artar; eski cevaba ait geç gelen sesler çalınmaz.
let generation = 0
let nextPlaybackId = 0
const outstanding = new Map<number, ReturnType<typeof setTimeout> | null>()
let synthChain: Promise<void> = Promise.resolve()
let replyDone = true
let afterSpeech: (() => void) | null = null
let assistantCaption = ''
let unsubscribeApproval: (() => void) | null = null

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err))
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// Ana pencereye ve açıksa çentiğe birlikte gider; çentik sadece "phase" olayını kullanır.
export function emitVoiceEvent(event: VoiceEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed()) window.webContents.send('voice:event', event)
  }
}

function setPhase(next: VoicePhase): void {
  phase = next
  emitVoiceEvent({ type: 'phase', phase, sessionActive })
}

function idlePhase(): VoicePhase {
  return getSettings().wakeWordEnabled && getVoicePaths().wakeword ? 'wake' : 'off'
}

export function getVoiceState(): VoiceState {
  return { phase, sessionActive }
}

// ---- Seslendirme ----

function cancelSpeech(): void {
  generation++
  const hadSpeech = outstanding.size > 0
  for (const timer of outstanding.values()) clearTimeout(timer ?? undefined)
  outstanding.clear()
  afterSpeech = null
  if (hadSpeech) emitVoiceEvent({ type: 'stop-playback' })
}

function enqueueSpeech(text: string, caption = false): void {
  const clean = plainForSpeech(text)
  if (!clean) return
  if (caption) {
    assistantCaption = assistantCaption ? `${assistantCaption} ${clean}` : clean
    emitVoiceEvent({ type: 'caption', role: 'assistant', text: assistantCaption, conversationId })
  }

  const gen = generation
  const id = ++nextPlaybackId
  outstanding.set(id, null)
  const settings = getSettings()
  const usePiper = settings.ttsEngine === 'piper' && isPiperReady()

  // Cümleler sırayla üretilir ve sırayla gönderilir; arayüz de aynı sırayla çalar
  synthChain = synthChain.then(async () => {
    if (gen !== generation) return
    let audio: ArrayBuffer | null = null
    if (usePiper) {
      try {
        audio = await getPiper().synthesize(clean)
      } catch (err) {
        console.error('Piper ses üretemedi, Windows sesi kullanılıyor:', err)
      }
    }
    if (gen !== generation || !outstanding.has(id)) return
    const estimatedMs = audio
      ? (audio.byteLength / (22050 * 2)) * 1000
      : (clean.length * 90) / settings.speechRate
    outstanding.set(
      id,
      setTimeout(() => voicePlaybackEnded(id), estimatedMs + PLAYBACK_GRACE_MS)
    )
    emitVoiceEvent({
      type: 'play',
      id,
      audio,
      text: clean,
      voiceUri: settings.voiceUri,
      rate: settings.speechRate,
      volume: settings.speechVolume,
      pitch: settings.voiceStyle === 'robot' ? ROBOT_PITCH : 1
    })
  })
}

/** Kısa bir cümle söyler ve bitince verilen işi yapar (ör. "Görüşmek üzere" → sohbeti bitir) */
function speakNotice(text: string, after: () => void): void {
  cancelSpeech()
  replyDone = true
  afterSpeech = after
  setPhase('responding')
  enqueueSpeech(text)
  maybeFinishTurn()
}

export function voicePlaybackEnded(id: number): void {
  if (!outstanding.has(id)) return
  clearTimeout(outstanding.get(id) ?? undefined)
  outstanding.delete(id)
  maybeFinishTurn()
}

/** Söylenecek bir şey kalmadıysa sıradaki adıma geç: yeniden dinle veya beklemeye dön */
function maybeFinishTurn(): void {
  if (outstanding.size > 0) return
  if (afterSpeech) {
    const next = afterSpeech
    afterSpeech = null
    next()
    return
  }
  if (phase !== 'responding' || !replyDone) return
  if (pendingApprovalId && isApprovalPending(pendingApprovalId)) return
  if (sessionActive) startCapture()
  else setPhase(idlePhase())
}

// ---- Oturum ----

function warmUpEngines(): void {
  const settings = getSettings()
  if (settings.sttProvider === 'local' && isLocalSttReady()) {
    getWhisper()
      .start()
      .catch((err) => console.error('Konuşma tanıma başlatılamadı:', err))
  }
  if (settings.ttsEngine === 'piper' && isPiperReady()) getPiper().warmUp()
  getVad().catch((err) => console.error('Konuşma algılama modeli yüklenemedi:', err))
}

function beginSession(): void {
  if (!sessionActive) {
    conversationId = null
    misunderstood = 0
  }
  sessionActive = true
  emitVoiceEvent({ type: 'wake' })
  cancelSpeech()
  warmUpEngines()
  startCapture()
}

let captureTimer: ReturnType<typeof setTimeout> | undefined

function startCapture(): void {
  // Konuşma bekleme süresi gelen ses parçalarıyla sayılır; mikrofondan hiç ses gelmezse
  // (ör. mikrofon açılamadı) dinleme sonsuza kadar sürmesin diye ayrıca saatle de sınırlanır
  clearTimeout(captureTimer)
  captureTimer = setTimeout(() => {
    if (phase === 'capturing' && !endpointer.isSpeaking) onNoSpeech()
  }, DEFAULT_ENDPOINTER.noSpeechTimeoutMs + 1500)
  endpointer.reset()
  vadNeedsReset = true
  remainder = new Float32Array(0)
  recentFrames = []
  bargeRun = 0
  setPhase('capturing')
}

function endSession(): void {
  clearTimeout(captureTimer)
  // Sesli konuşma bitti: hafıza işleyici ilk uygun anda bu sohbeti öncelikle işlesin
  if (conversationId !== null) requestMemoryProcessing(conversationId)
  sessionActive = false
  pendingApprovalId = null
  misunderstood = 0
  queue.length = 0
  wakeCooldownUntil = Date.now() + WAKE_COOLDOWN_MS
  const next = idlePhase()
  if (next === 'wake')
    getWakeWordDetector().then(
      (detector) => detector.reset(),
      () => {}
    )
  setPhase(next)
}

function onNoSpeech(): void {
  // Onay bekleniyorsa kart ekranda durur; kullanıcı oradan da cevap verebilir
  if (pendingApprovalId && isApprovalPending(pendingApprovalId)) {
    setPhase('responding')
    return
  }
  endSession()
}

async function finishCapture(audio: Float32Array): Promise<void> {
  setPhase('transcribing')
  queue.length = 0
  let text: string
  try {
    text = await transcribeAudio(encodeWav(normalizeGain(audio), 16000), 'audio/wav')
  } catch (err) {
    const message = errorText(err)
    const notUnderstood = message.includes('anlaşılamadı')
    if (notUnderstood && ++misunderstood <= MAX_MISUNDERSTOOD) {
      speakNotice('Anlayamadım, tekrar söyler misin?', startCapture)
      return
    }
    if (!notUnderstood) {
      console.error('Sesli komut yazıya çevrilemedi:', err)
      emitVoiceEvent({ type: 'error', message })
    }
    speakNotice(notUnderstood ? 'Anlayamadım. Gerekirse beni tekrar çağır.' : message, endSession)
    return
  }
  // Kullanıcı bu arada sohbeti bitirmiş olabilir
  if (!sessionActive) return
  misunderstood = 0
  emitVoiceEvent({ type: 'caption', role: 'user', text, conversationId })
  handleUtterance(text)
}

function handleUtterance(text: string): void {
  if (pendingApprovalId && isApprovalPending(pendingApprovalId)) {
    const answer = parseConfirmation(text)
    if (!answer) {
      speakNotice('Onaylamak için evet, vazgeçmek için hayır de.', startCapture)
      return
    }
    respondToApproval(pendingApprovalId, answer === 'yes')
    pendingApprovalId = null
    // Asistan onay cevabıyla işine devam eder; cevabı bitince yeniden dinlenir
    setPhase('responding')
    return
  }
  pendingApprovalId = null
  if (isStopRequest(text)) {
    speakNotice('Görüşmek üzere.', endSession)
    return
  }
  void askAssistant(text)
}

async function askAssistant(text: string): Promise<void> {
  const sender = getMainWindow()?.webContents
  if (!sender || sender.isDestroyed()) {
    endSession()
    return
  }
  if (conversationId === null) conversationId = createConversation().id
  const id = conversationId

  // Önceki cevap hâlâ yazılıyorsa durdurulur (kullanıcı sözünü kesmiş olabilir)
  if (isReplying(id)) {
    stopChat(id)
    for (let i = 0; i < 30 && isReplying(id); i++) await delay(100)
  }

  cancelSpeech()
  const gen = generation
  const splitter = new SentenceSplitter()
  assistantCaption = ''
  replyDone = false
  setPhase('responding')
  try {
    sendMessage(sender, id, text, {
      source: 'voice',
      onDelta: (delta) => {
        if (gen !== generation) return
        for (const sentence of splitter.push(delta)) enqueueSpeech(sentence, true)
      },
      onFinish: (result) => finishReply(result, splitter, gen)
    })
  } catch (err) {
    replyDone = true
    console.error('Sesli komut gönderilemedi:', err)
    speakNotice(errorText(err), endSession)
  }
}

function finishReply(result: ReplyResult, splitter: SentenceSplitter, gen: number): void {
  if (gen !== generation) return
  const rest = splitter.flush()
  if (rest) enqueueSpeech(rest, true)
  if (result.error) {
    enqueueSpeech(`Bir sorun oluştu. ${result.error}`)
  } else if (!result.stopped && !assistantCaption && result.message?.tools.length) {
    // Model sadece araç kullanıp bir şey yazmadıysa sessiz kalmasın
    enqueueSpeech('Tamam, hallettim.', true)
  }
  replyDone = true
  maybeFinishTurn()
}

// ---- Mikrofon sesi ----

function toFrames(chunk: Float32Array): Float32Array[] {
  const joined = new Float32Array(remainder.length + chunk.length)
  joined.set(remainder)
  joined.set(chunk, remainder.length)
  const frames: Float32Array[] = []
  let offset = 0
  for (; offset + VAD_FRAME_SAMPLES <= joined.length; offset += VAD_FRAME_SAMPLES) {
    frames.push(joined.slice(offset, offset + VAD_FRAME_SAMPLES))
  }
  remainder = joined.slice(offset)
  return frames
}

async function handleChunk(chunk: Float32Array): Promise<void> {
  if (phase === 'wake') {
    const detector = await getWakeWordDetector()
    const score = await detector.process(chunk)
    if (phase !== 'wake' || Date.now() < wakeCooldownUntil) return
    if (score >= getSettings().wakeWordThreshold) {
      console.info(`"Hey Jarvis" algılandı (puan ${score.toFixed(2)})`)
      detector.reset()
      beginSession()
    }
    return
  }
  if (phase !== 'capturing' && phase !== 'responding') return

  const vad = await getVad()
  if (vadNeedsReset) {
    vad.reset()
    vadNeedsReset = false
  }
  const bargeInEnabled = getSettings().voiceBargeIn

  for (const frame of toFrames(chunk)) {
    const probability = await vad.probability(frame)
    if (phase === 'capturing') {
      const result = endpointer.push(frame, probability)
      if (result.type === 'done') {
        void finishCapture(result.audio)
        return
      }
      if (result.type === 'timeout') {
        onNoSpeech()
        return
      }
      continue
    }
    if (phase !== 'responding') return

    recentFrames.push(frame)
    if (recentFrames.length > RECENT_FRAMES) recentFrames.shift()
    if (!bargeInEnabled || !sessionActive || outstanding.size === 0) {
      bargeRun = 0
      continue
    }
    bargeRun = probability >= BARGE_IN_PROBABILITY ? bargeRun + 1 : 0
    if (bargeRun * FRAME_MS >= BARGE_IN_MS) {
      console.info("Kullanıcı Pıtır'ın sözünü kesti")
      const primed = recentFrames
      cancelSpeech()
      startCapture()
      for (const recent of primed) endpointer.push(recent, 1)
      return
    }
  }
}

async function drain(): Promise<void> {
  draining = true
  try {
    while (queue.length > 0) {
      const chunk = queue.shift()!
      try {
        await handleChunk(chunk)
      } catch (err) {
        queue.length = 0
        console.error('Ses işlenemedi:', err)
        emitVoiceEvent({ type: 'error', message: errorText(err) })
        // Aynı hata her parçada tekrarlanmasın
        if (sessionActive) endSession()
        else setPhase('off')
      }
    }
  } finally {
    draining = false
  }
}

// ---- Dışarıya açık işlemler ----

let receivedChunks = 0
let invalidChunkReported = false

export function pushVoiceAudio(chunk: unknown): void {
  if (phase === 'off' || phase === 'transcribing') return
  if (!(chunk instanceof Float32Array) || chunk.length !== WAKE_CHUNK_SAMPLES) {
    if (!invalidChunkReported) {
      invalidChunkReported = true
      console.warn(
        'Mikrofondan beklenmeyen ses verisi geldi:',
        Object.prototype.toString.call(chunk),
        (chunk as { length?: number } | null)?.length
      )
    }
    return
  }
  if (receivedChunks++ === 0) console.info('Pıtır mikrofonu dinliyor')
  queue.push(chunk)
  if (queue.length > MAX_QUEUED_CHUNKS) queue.splice(0, queue.length - MAX_QUEUED_CHUNKS)
  if (!draining) void drain()
}

/** Ayar veya ses paketi değişince bekleme durumunu yeniden hesaplar */
export function refreshVoiceSession(): void {
  if (sessionActive || (phase !== 'off' && phase !== 'wake')) return
  const next = idlePhase()
  if (next === 'wake') {
    getWakeWordDetector().catch((err) => {
      console.error('"Hey Jarvis" modeli yüklenemedi:', err)
      emitVoiceEvent({ type: 'error', message: errorText(err) })
    })
  }
  setPhase(next)
}

export function initVoiceSession(): void {
  unsubscribeApproval = onApprovalRequested((approvalConversationId, approval) => {
    if (!sessionActive || approvalConversationId !== conversationId) return
    pendingApprovalId = approval.id
    const title = approval.label.replace(/\?\s*$/, '')
    enqueueSpeech(`${title}: ${approval.summary}. Onaylıyor musun?`)
    afterSpeech = startCapture
    maybeFinishTurn()
  })
  refreshVoiceSession()
}

/** Küreye tıklanınca: uyandırma kelimesi beklemeden dinlemeye başla */
export function startVoiceTurn(): void {
  beginSession()
}

export function stopVoiceSession(): void {
  cancelSpeech()
  if (conversationId !== null && isReplying(conversationId)) stopChat(conversationId)
  endSession()
}

/**
 * Metni cümlelere bölüp seçili motorla seslendirir. Sohbetteki "sesli oku" önceki konuşmayı keser;
 * Pıtır'ın uyarıları `{ interrupt: false }` ile sıraya eklenir (aynı anda gelen iki uyarı
 * birbirinin sözünü kesmesin).
 */
export function speakWithVoice(text: string, options: { interrupt?: boolean } = {}): void {
  // Sesli sohbet sürerken araya başka metin okunmaz
  if (sessionActive) return
  if (options.interrupt !== false) cancelSpeech()
  const splitter = new SentenceSplitter()
  for (const sentence of splitter.push(text.slice(0, MAX_SPEAK_TEXT))) enqueueSpeech(sentence)
  const rest = splitter.flush()
  if (rest) enqueueSpeech(rest)
}

export function stopVoiceSpeaking(): void {
  cancelSpeech()
  maybeFinishTurn()
}

export function disposeVoiceSession(): void {
  clearTimeout(captureTimer)
  unsubscribeApproval?.()
  unsubscribeApproval = null
  cancelSpeech()
  disposeVoiceEngines()
}
