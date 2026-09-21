import { useSyncExternalStore } from 'react'
import type { VoicePhase } from '@shared/api'

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

/** Kürenin o anki duygu sinyali; yoksa null */
export function useAssistantEmotion(): EmotionSignal | null {
  return useSyncExternalStore(subscribeEmotion, () => emotion)
}

export function useAssistantState(): AssistantState {
  return useSyncExternalStore(subscribe, () => current)
}
