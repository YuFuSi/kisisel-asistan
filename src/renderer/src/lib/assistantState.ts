import { useSyncExternalStore } from 'react'
import type { ChatEvent, ToolApproval, ToolCard, VoicePhase } from '@shared/api'
import type { ApprovalResult } from '@shared/api'
import { finishedOutcome, shouldCelebrate, type OutcomeKind } from './outcome'
import { playSfx } from './soundEffects'
import { upsertStep, type WorkStep } from './workSteps'

/** Jarvis küresinin ve menüdeki durum göstergesinin gösterdiği durum */
export type AssistantState = 'idle' | 'listening' | 'thinking' | 'working' | 'speaking' | 'approval'

export const STATE_LABELS: Record<AssistantState, string> = {
  idle: 'Hazır',
  listening: 'Dinliyor',
  thinking: 'Düşünüyor',
  working: 'Çalışıyor',
  speaking: 'Konuşuyor',
  approval: 'Onay bekliyor'
}

export type { OutcomeKind }

/** Biten bir cevabın sonucu (bkz. lib/outcome.ts) */
export interface Outcome {
  conversationId: number
  kind: OutcomeKind
  /** Bu cevapta kullanılan araç sayısı */
  toolCount: number
  /** Her yeni sonuçta artar */
  seq: number
}

export interface PendingApproval {
  conversationId: number
  approval: ToolApproval
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

// Bağlamsal kartlar: son cevapta araçların ürettiği kartlar; adımlar temizlense de yeni cevaba
// kadar kalır (sesli sohbette altyazının altında, çentikte, işlem yüzeyinde gösterilir)
const cardListeners = new Set<() => void>()
let cards: ToolCard[] = []
const MAX_CARDS = 3

function setCards(next: ToolCard[]): void {
  cards = next
  cardListeners.forEach((listener) => listener())
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
    const card = event.activity.card
    if (card) setCards([...cards, card].slice(-MAX_CARDS))
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
  // Sesli sohbette Jarvis zaten konuşuyor; sadece yazılı akışta efekt çal
  if (kind === 'error') playSfx('error')
  else if (kind === 'unsure') playSfx('approval')
  else if (kind === 'success' && voicePhase === 'off') playSfx('done')
}
/** Kullanıcı bir işi bitirdi (ör. görev tamamladı): küre yeşil parıltıyla kutlar */
export function celebrate(): void {
  setEmotion('success')
}

// Cevap yazılan sohbetler ve her birinde o an çalışan araçlar
const replies = new Map<number, Set<string>>()
let listening = false
let speaking = false
// Sesli sohbetin aşaması ("hey jarvis" bekleme durumu küreyi değiştirmez)
let voicePhase: VoicePhase = 'off'
let current: AssistantState = 'idle'
let chatSubscribed = false

// Bekleyen onaylar: hangi sayfada olunursa olsun görünür kalsın diye burada tutulur
const approvalListeners = new Set<() => void>()
let approvals: PendingApproval[] = []

function setApprovals(next: PendingApproval[]): void {
  approvals = next
  approvalListeners.forEach((listener) => listener())
}

// Cevap başına araçlar (id → hata verdi mi) ve reddedilen onay; bitişte sonuca çevrilir
const replyTools = new Map<number, Map<string, boolean>>()
const replyApprovals = new Map<number, ApprovalResult[]>()
const outcomeListeners = new Set<() => void>()
let outcome: Outcome | null = null
let outcomeSeq = 0

function publishOutcome(conversationId: number, kind: OutcomeKind): void {
  const toolCount = replyTools.get(conversationId)?.size ?? 0
  outcome = { conversationId, kind, toolCount, seq: ++outcomeSeq }
  replyTools.delete(conversationId)
  replyApprovals.delete(conversationId)
  outcomeListeners.forEach((listener) => listener())
  // Küre sadece gerçekten yapılmış bir işi kutlar; düz metin cevabı veya kısmi iş kutlanmaz
  if (shouldCelebrate(kind, toolCount)) setEmotion('success')
}

function trackOutcome(event: ChatEvent): void {
  const id = event.conversationId
  switch (event.type) {
    case 'tool': {
      const tools = replyTools.get(id) ?? new Map<string, boolean>()
      tools.set(event.activity.id, event.activity.status === 'error')
      replyTools.set(id, tools)
      break
    }
    case 'approval':
      setApprovals([
        ...approvals.filter((item) => item.approval.id !== event.approval.id),
        { conversationId: id, approval: event.approval }
      ])
      break
    case 'approval-resolved':
      replyApprovals.set(id, [...(replyApprovals.get(id) ?? []), event.result])
      setApprovals(approvals.filter((item) => item.approval.id !== event.approvalId))
      break
    case 'done': {
      // Ana sürecin mesajla birlikte kaydettiği sonuç esastır; yoksa buradan hesaplanır
      publishOutcome(
        id,
        event.message.outcome ??
          finishedOutcome([...(replyTools.get(id)?.values() ?? [])], replyApprovals.get(id) ?? [])
      )
      setApprovals(approvals.filter((item) => item.conversationId !== id))
      break
    }
    case 'stopped':
    case 'error':
      publishOutcome(id, event.type)
      setApprovals(approvals.filter((item) => item.conversationId !== id))
      break
  }
}

function compute(): AssistantState {
  if (listening || voicePhase === 'capturing') return 'listening'
  // Onay beklerken iş durur; araç "çalışıyor" görünse de asıl durum kullanıcıyı beklemek
  if (approvals.length > 0) return 'approval'
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
    // Yeni bir cevap başlıyor: önceki cevabın kartları kalkar
    if (!replies.has(event.conversationId) && (event.type === 'delta' || event.type === 'tool')) {
      if (cards.length > 0) setCards([])
    }
    trackSteps(event)
    if (event.type === 'delta') replyChunks += 1
    // Duygu: onay beklerken kararsız, cevap bitince başarı, hata olunca hata; durdurma/onay sonrası sakin
    trackOutcome(event)
    if (event.type === 'approval') setEmotion('unsure')
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

/**
 * Mesaj gönderilemediyse (ör. model seçili değil) çağrılır; aksi halde küre sonsuza kadar
 * "düşünüyor" kalırdı çünkü ana süreçten hiç bitiş olayı gelmez
 */
export function noteReplyFailed(conversationId: number): void {
  replyTools.delete(conversationId)
  replyApprovals.delete(conversationId)
  if (replies.delete(conversationId)) update()
}

/** Onayı yanıtlar; kart her yerden aynı anda kalkar */
export function respondToApproval(approvalId: string, approved: boolean): void {
  setApprovals(approvals.filter((item) => item.approval.id !== approvalId))
  update()
  void window.api.chat.respondToApproval(approvalId, approved)
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

function subscribeCards(listener: () => void): () => void {
  subscribeChat()
  cardListeners.add(listener)
  return () => {
    cardListeners.delete(listener)
  }
}

/** Son cevabın bağlamsal kartları (en fazla 3); yoksa boş dizi */
export function useResultCards(): ToolCard[] {
  return useSyncExternalStore(subscribeCards, () => cards)
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
  playSfx('notice')
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

function subscribeApprovals(listener: () => void): () => void {
  subscribeChat()
  approvalListeners.add(listener)
  return () => {
    approvalListeners.delete(listener)
  }
}

/** Yanıt bekleyen onaylar (en eskisi başta) */
export function usePendingApprovals(): PendingApproval[] {
  return useSyncExternalStore(subscribeApprovals, () => approvals)
}

function subscribeOutcome(listener: () => void): () => void {
  subscribeChat()
  outcomeListeners.add(listener)
  return () => {
    outcomeListeners.delete(listener)
  }
}

/** Son biten cevabın sonucu; henüz yoksa null */
export function useLastOutcome(): Outcome | null {
  return useSyncExternalStore(subscribeOutcome, () => outcome)
}

// Sohbet sayfasında o an ekranda olan sohbet; onun onayı zaten sohbetin içinde görünür
const visibleListeners = new Set<() => void>()
let visibleConversation: number | null = null

export function setVisibleConversation(id: number | null): void {
  if (visibleConversation === id) return
  visibleConversation = id
  visibleListeners.forEach((listener) => listener())
}

function subscribeVisible(listener: () => void): () => void {
  visibleListeners.add(listener)
  return () => {
    visibleListeners.delete(listener)
  }
}

export function useVisibleConversation(): number | null {
  return useSyncExternalStore(subscribeVisible, () => visibleConversation)
}

/** Kürenin o anki duygu sinyali; yoksa null */
export function useAssistantEmotion(): EmotionSignal | null {
  return useSyncExternalStore(subscribeEmotion, () => emotion)
}

export function useAssistantState(): AssistantState {
  return useSyncExternalStore(subscribe, () => current)
}
