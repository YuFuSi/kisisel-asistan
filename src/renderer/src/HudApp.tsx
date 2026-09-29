import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { VoicePhase } from '@shared/api'
import Orb from './components/jarvis/Orb'
import OrbitTools from './components/jarvis/OrbitTools'
import { STATE_LABELS, type AssistantState } from './lib/assistantState'
import { useClock } from './lib/deviceStatus'
import { useHandTracking } from './lib/useHandTracking'
import { hasCamera, useClapActivation } from './lib/useClapActivation'

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

// Tur O: HUD'da da el ile kontrol. Normal boyut 300x130; el kontrolü açılınca küçük bir
// yörünge sığacak kadar büyür (sağ üst köşe sabit kalır, bkz. system/hud.ts → resizeHud).
const NORMAL_WIDTH = 300
const NORMAL_HEIGHT = 130
const HAND_WIDTH = 340
const HAND_HEIGHT = 300
const HAND_ORBIT_RADIUS_X = 110
const HAND_ORBIT_RADIUS_Y = 60
const HAND_ORBIT_HOVER_DISTANCE = 45
const HAND_GAIN_X = 320
const HAND_GAIN_Y = 220

function HudApp(): React.JSX.Element {
  const [phase, setPhase] = useState<VoicePhase>('off')
  const [sessionActive, setSessionActive] = useState(false)
  const [handControlOn, setHandControlOn] = useState(false)
  const now = useClock()
  const resizedRef = useRef(false)
  // Jarvis bir uyarı gösterince (hatırlatma, pil, proaktif) HUD küresi de nabız atar
  const [notice, setNotice] = useState(0)

  useEffect(
    () =>
      window.api.events.onCommand((command) => {
        if (command === 'notified') setNotice((n) => n + 1)
      }),
    []
  )

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

  const {
    videoRef: handVideoRef,
    pinching: handPinching,
    handPoint
  } = useHandTracking(handControlOn, HAND_GAIN_X, HAND_GAIN_Y)
  // Ana Sayfa'daki gibi: Jarvis konuşurken kendi sesi alkış sayılmasın, kamera yoksa açılmasın
  useClapActivation(true, () => {
    if (phase === 'responding' || phase === 'capturing') return
    if (handControlOn) {
      setHandControlOn(false)
      return
    }
    void hasCamera().then((available) => {
      if (available) setHandControlOn(true)
    })
  })

  useEffect(() => {
    // İlk render'da (henüz hiç değişmemişken) gereksiz bir resize çağrısı atlanır
    if (!resizedRef.current) {
      resizedRef.current = true
      return
    }
    void window.api.hud.resize(
      handControlOn ? HAND_WIDTH : NORMAL_WIDTH,
      handControlOn ? HAND_HEIGHT : NORMAL_HEIGHT
    )
  }, [handControlOn])

  const state = stateFromPhase(phase)

  function toggleVoice(): void {
    if (sessionActive) void window.api.voice.stopSession()
    else void window.api.voice.startTurn()
  }

  function selectFromOrbit(page: string): void {
    void window.api.hud.navigate(page)
  }

  return (
    <div className="drag-region flex h-full w-full flex-col rounded-2xl border border-line bg-surface shadow-float">
      <video ref={handVideoRef} className="hidden" muted playsInline />
      <div className="flex items-start justify-end pt-1 pr-1">
        <button
          onClick={() => window.close()}
          aria-label="HUD panelini kapat"
          title="Kapat"
          className="no-drag rounded-md p-1 text-faint transition-colors hover:bg-elevated hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {handControlOn ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 pb-3">
          <div className="relative flex items-center justify-center">
            <Orb state={state} size={90} notice={notice} />
            <div className="pointer-events-none absolute">
              <OrbitTools
                handPoint={handPoint}
                pinching={handPinching}
                onSelect={selectFromOrbit}
                radiusX={HAND_ORBIT_RADIUS_X}
                radiusY={HAND_ORBIT_RADIUS_Y}
                hoverDistance={HAND_ORBIT_HOVER_DISTANCE}
              />
            </div>
          </div>
          <p className="text-center text-[11px] text-faint">Kapatmak için iki alkış</p>
        </div>
      ) : (
        <div className="flex flex-1 items-center gap-2 pr-3 pl-1">
          <button
            onClick={toggleVoice}
            aria-label={sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
            title={sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
            className="no-drag shrink-0 cursor-pointer rounded-full"
          >
            <Orb state={state} size={120} notice={notice} />
          </button>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-ink">Jarvis</div>
            <div className="truncate text-xs text-muted">{STATE_LABELS[state]}</div>
            <div className="mt-1 text-[11px] text-faint">
              {now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HudApp
