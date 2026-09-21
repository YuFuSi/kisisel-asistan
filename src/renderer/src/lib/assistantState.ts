import { useSyncExternalStore } from 'react'
import type { VoicePhase } from '@shared/api'
import { upsertStep, type WorkStep } from './workSteps'

/** Jarvis küresinin ve menüdeki durum göstergesinin gösterdiği durum */
export type AssistantState = 'idle' | 'listening' | 'thinking' | 'working' | 'speaking'

export const STATE_LABELS: Record<AssistantState, string> = {
  idle: 'Hazır',
  listening: 'Dinliyor',
  thinking: 'Düşünüyor',
  working: 'Çalışıyor',
  speaking: 'Konuşuyor'
}

/** Kürenin kısa süreli duygu hâlleri: iş bitti (success), hata (error), onay bekliyor (unsure) */
export type Emotion = 'success' | 'error' | 'unsure'

export interface EmotionSignal {
  kind: Emotion
  /** Her yeni duygu için artar; küre aynı duyguyu iki kez ayırt edebilsin */
  seq: number
}

const listeners = new Set<() => void>()
const emotionListeners = new Set<() => void>()
let emotion: EmotionSignal | null = null
let emotionSeq = 0

// İş ilerleyişi: cevap sırasında çalışan araç adımları; cevap bitince kısa süre görünüp temizlenir
const stepListeners = new Set<() => void>()
let steps: WorkStep[] = []
let stepsFinishing = false
let stepsTimer: ReturnType<typeof setTimeout> | undefined
const STEPS_LINGER_MS = 1600

function notifySteps(): void {
  stepListeners.forEach((listener) => listener())
}

function trackSteps(event: { type: string; activity?: Parameters<typeof upsertStep>[1] }): void {
  if (event.type === 'tool' && event.activity) {
    // Önceki cevabın bitmiş adımları yeni cevapta karışmasın
    if (stepsFinishing) {
      clearTimeout(stepsTimer)
      stepsFinishing = false
      steps = []
    }
    steps = upsertStep(steps, event.activity)
    notifySteps()
  } else if (event.type === 'done' || event.type === 'stopped' || event.type === 'error') {
    if (steps.length === 0) return
    stepsFinishing = true
    clearTimeout(stepsTimer)
    stepsTimer = setTimeout(() => {
      steps = []
      stepsFinishing = false
      notifySteps()
    }, STEPS_LINGER_MS)
  }
}

function setEmotion(kind: Emotion | null): void {
  emotion = kind ? { kind, seq: ++emotionSeq } : null
  emotionListeners.forEach((listener) => listener())
}
// Cevap yazılan sohbetler ve her birinde o an çalışan araçlar
const replies = new Map<number, Set<string>>()
let listening = false
let speaking = false
// Sesli sohbetin aşaması ("hey jarvis" bekleme durumu küreyi değiştirmez)
let voicePhase: VoicePhase = 'off'
let current: AssistantState = 'idle'
let chatSubscribed = false

function compute(): AssistantState {
  if (listening || voicePhase === 'capturing') return 'listening'
  if (speaking) return 'speaking'
  if (voicePhase === 'transcribing') return 'thinking'
  for (const runningTools of replies.values()) {
    if (runningTools.size > 0) return 'working'
  }
  return replies.size > 0 ? 'thinking' : 'idle'
}

function update(): void {
  const next = compute()
  if (next === current) return
  current = next
  listeners.forEach((listener) => listener())
}

// Sohbet olayları (cevap parçası, araç, bitiş) bir kez dinlenir; hangi sayfa açık olursa olsun durum güncel kalır
function subscribeChat(): void {
  if (chatSubscribed) return
  chatSubscribed = true
  window.api.chat.onEvent((event) => {
    const runningTools = replies.get(event.conversationId) ?? new Set<string>()
    trackSteps(event)
    if (event.type === 'delta') replyChunks += 1
    // Duygu: onay beklerken kararsız, cevap bitince başarı, hata olunca hata; durdurma/onay sonrası sakin
    if (event.type === 'approval') setEmotion('unsure')
    else if (event.type === 'done') setEmotion('success')
    else if (event.type === 'error') setEmotion('error')
    else if (event.type === 'approval-resolved' || event.type === 'stopped') setEmotion(null)
    switch (event.type) {
      case 'delta':
      case 'approval':
      case 'approval-resolved':
        replies.set(event.conversationId, runningTools)
        break
      case 'tool':
        if (event.activity.status === 'running') runningTools.add(event.activity.id)
        else runningTools.delete(event.activity.id)
        replies.set(event.conversationId, runningTools)
        break
      default:
        // done, stopped, error
        replies.delete(event.conversationId)
    }
    update()
  })
}

/** Mesaj gönderilince çağrılır; ilk cevap parçası gelene kadar "düşünüyor" görünsün */
export function noteReplyStarted(conversationId: number): void {
  if (!replies.has(conversationId)) replies.set(conversationId, new Set())
  update()
}

export function setListening(value: boolean): void {
  listening = value
  update()
}

export function setVoicePhase(value: VoicePhase): void {
  voicePhase = value
  update()
}

export function setSpeaking(value: boolean): void {
  speaking = value
  update()
}

function subscribe(listener: () => void): () => void {
  subscribeChat()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function subscribeEmotion(listener: () => void): () => void {
  subscribeChat()
  emotionListeners.add(listener)
  return () => {
    emotionListeners.delete(listener)
  }
}

function subscribeSteps(listener: () => void): () => void {
  subscribeChat()
  stepListeners.add(listener)
  return () => {
    stepListeners.delete(listener)
  }
}

/** Asistanın şu anki cevabında çalışan ve biten araç adımları; iş yoksa boş dizi */
export function useWorkSteps(): WorkStep[] {
  return useSyncExternalStore(subscribeSteps, () => steps)
}

// Cevap nabzı: cevap yazılırken her yeni parçada artar; küre çizim döngüsünde doğrudan okur (yeniden çizim yok)
let replyChunks = 0

export function getReplyChunks(): number {
  return replyChunks
}

// Bildirim nabzı: bir Windows bildirimi gösterilince artar, küre iki kez nabız atar
const noticeListeners = new Set<() => void>()
let noticeSeq = 0

export function noteNotification(): void {
  noticeSeq += 1
  noticeListeners.forEach((listener) => listener())
}

function subscribeNotice(listener: () => void): () => void {
  noticeListeners.add(listener)
  return () => {
    noticeListeners.delete(listener)
  }
}

/** Her bildirimde artan sayaç; 0 = hiç bildirim yok */
export function useNoticeSeq(): number {
  return useSyncExternalStore(subscribeNotice, () => noticeSeq)
}

/** Kürenin o anki duygu sinyali; yoksa null */
export function useAssistantEmotion(): EmotionSignal | null {
  return useSyncExternalStore(subscribeEmotion, () => emotion)
}

export function useAssistantState(): AssistantState {
  return useSyncExternalStore(subscribe, () => current)
}
