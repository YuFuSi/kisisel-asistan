import { useEffect, useState } from 'react'
import type { VoicePhase } from '@shared/api'
import { setVoicePhase, useAssistantState, type AssistantState } from './assistantState'

export interface RemoteAssistant {
  state: AssistantState
  sessionActive: boolean
  /** Jarvis bir uyarı gösterdikçe artar (küre nabız atar) */
  notice: number
}

// Yardımcı pencere (çentik) ana pencereyle aynı durumu gösterir: sohbet olayları ana
// süreçten tüm pencerelere yayınlanır (assistantState bunları dinler), sesli sohbetin aşaması da
// voice olaylarıyla gelir. Ses çalma ana pencerede olduğu için "konuşuyor", sesli sohbet cevap
// verirken başka iş yoksa buradan çıkarılır.
export function useRemoteAssistant(): RemoteAssistant {
  const base = useAssistantState()
  const [phase, setPhase] = useState<VoicePhase>('off')
  const [sessionActive, setSessionActive] = useState(false)
  const [notice, setNotice] = useState(0)

  useEffect(() => {
    const apply = (next: VoicePhase, active: boolean): void => {
      setPhase(next)
      setSessionActive(active)
      setVoicePhase(next)
    }
    window.api.voice.state().then(
      (state) => apply(state.phase, state.sessionActive),
      () => {}
    )
    const offVoice = window.api.voice.onEvent((event) => {
      if (event.type === 'phase') apply(event.phase, event.sessionActive)
    })
    const offCommand = window.api.events.onCommand((command) => {
      if (command === 'notified') setNotice((n) => n + 1)
    })
    return () => {
      offVoice()
      offCommand()
    }
  }, [])

  const state = base === 'idle' && phase === 'responding' ? 'speaking' : base
  return { state, sessionActive, notice }
}

/** Yardımcı penceredeki küreye tıklanınca ana süreçteki sesli sohbeti başlatır/bitirir */
export function toggleRemoteVoice(sessionActive: boolean): void {
  if (sessionActive) void window.api.voice.stopSession()
  else void window.api.voice.startTurn()
}
