import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { VoicePhase } from '@shared/api'
import Orb from './components/jarvis/Orb'
import { STATE_LABELS, type AssistantState } from './lib/assistantState'
import { useClock } from './lib/deviceStatus'

// HUD, ana pencereden ayrı bir Electron penceresinde (kendi JS ortamında) çalışır; ana sesli sohbet
// hattını (mikrofon, ses çalma) tekrar başlatmaz, sadece ana sürecin yayınladığı "phase" olayını
// izleyip küçük bir küre ve saat gösterir. Bu yüzden tam AssistantState değil, basitleştirilmiş bir eşleme kullanılır.
function stateFromPhase(phase: VoicePhase): AssistantState {
  switch (phase) {
    case 'capturing':
      return 'listening'
    case 'transcribing':
      return 'thinking'
    case 'responding':
      return 'speaking'
    default:
      return 'idle'
  }
}

function HudApp(): React.JSX.Element {
  const [phase, setPhase] = useState<VoicePhase>('off')
  const now = useClock()

  useEffect(() => {
    window.api.voice.state().then(
      (state) => setPhase(state.phase),
      () => {}
    )
    return window.api.voice.onEvent((event) => {
      if (event.type === 'phase') setPhase(event.phase)
    })
  }, [])

  const state = stateFromPhase(phase)

  return (
    <div className="drag-region flex h-full w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-float">
      <Orb state={state} size={56} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-sm font-medium text-ink">Jarvis</div>
        <div className="truncate text-xs text-muted">{STATE_LABELS[state]}</div>
        <div className="mt-1 text-[11px] text-faint">
          {now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <button
        onClick={() => window.close()}
        aria-label="HUD panelini kapat"
        title="Kapat"
        className="no-drag rounded-md p-1 text-faint transition-colors hover:bg-elevated hover:text-ink"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export default HudApp
