import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { VoicePhase } from '@shared/api'
import Orb from './components/jarvis/Orb'
import { STATE_LABELS, type AssistantState } from './lib/assistantState'
import { useClock } from './lib/deviceStatus'

// HUD, ana pencereden ayrı bir Electron penceresinde (kendi JS ortamında) çalışır; ana sesli sohbet
// hattını (mikrofon, ses çalma) tekrar başlatmaz, sadece ana sürecin yayınladığı "phase" olayını
// izleyip küre ve saat gösterir. Küreye tıklamak ana süreçteki sesli sohbeti başlatır/bitirir; mikrofonu
// ana pencerenin sesli sohbet hattı açar. Bu yüzden tam AssistantState değil, basitleştirilmiş bir eşleme kullanılır.
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
  const [sessionActive, setSessionActive] = useState(false)
  const now = useClock()

  useEffect(() => {
    window.api.voice.state().then(
      (state) => {
        setPhase(state.phase)
        setSessionActive(state.sessionActive)
      },
      () => {}
    )
    return window.api.voice.onEvent((event) => {
      if (event.type === 'phase') {
        setPhase(event.phase)
        setSessionActive(event.sessionActive)
      }
    })
  }, [])

  const state = stateFromPhase(phase)

  function toggleVoice(): void {
    if (sessionActive) void window.api.voice.stopSession()
    else void window.api.voice.startTurn()
  }

  return (
    <div className="drag-region flex h-full w-full items-center gap-2 rounded-2xl border border-line bg-surface pr-3 pl-1 shadow-float">
      <button
        onClick={toggleVoice}
        aria-label={sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
        title={sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
        className="no-drag shrink-0 cursor-pointer rounded-full"
      >
        <Orb state={state} size={120} />
      </button>
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
        className="no-drag self-start rounded-md p-1 text-faint transition-colors hover:bg-elevated hover:text-ink"
      >
        <X className="mt-2 h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export default HudApp
