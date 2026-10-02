import { BatteryCharging, BatteryFull, BatteryLow, BatteryMedium } from 'lucide-react'
import Logo from './jarvis/Logo'
import Orb from './jarvis/Orb'
import SystemStatusIcons from './SystemStatusIcons'
import { useBattery, useClock, type BatteryInfo } from '../lib/deviceStatus'
import {
  useAssistantEmotion,
  useAssistantState,
  useNoticeSeq,
  useWorkSteps
} from '../lib/assistantState'
import { toggleVoiceSession, useVoice } from '../lib/voiceClient'

interface TitleBarProps {
  /** O an açık olan sayfanın adı */
  page: string
  /** Ana Sayfa dışında logonun yerinde küçük, canlı küre durur (Jarvis her sayfada yanında) */
  showOrb: boolean
}

// Ana Sayfa'daki kürenin küçük kopyası: aynı durum, duygu ve bildirim nabzı; tıklayınca konuşur
function CornerOrb(): React.JSX.Element {
  const state = useAssistantState()
  const emotion = useAssistantEmotion()
  const steps = useWorkSteps()
  const notice = useNoticeSeq()
  const voice = useVoice()
  const label = voice.sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'
  return (
    <button
      onClick={toggleVoiceSession}
      aria-label={label}
      title={label}
      className="no-drag relative h-6 w-6 shrink-0 cursor-pointer rounded-full"
    >
      <span
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 [&_canvas]:max-w-none"
        style={{ width: 56, height: 56 }}
      >
        <Orb state={state} size={56} emotion={emotion} steps={steps} notice={notice} />
      </span>
    </button>
  )
}

function BatteryIcon({ level, charging }: BatteryInfo): React.JSX.Element {
  const className = 'h-4 w-4'
  if (charging) return <BatteryCharging className={className} />
  if (level < 0.25) return <BatteryLow className={className} />
  if (level < 0.7) return <BatteryMedium className={className} />
  return <BatteryFull className={className} />
}

// Windows'un gri başlık çubuğu yerine uygulamanın kendi çubuğu.
// Kapat/küçült düğmeleri Windows tarafından sağ tarafa çizilir, o alan boş bırakılır.
function TitleBar({ page, showOrb }: TitleBarProps): React.JSX.Element {
  const now = useClock()
  const battery = useBattery()

  return (
    <header
      className="drag-region flex h-[var(--titlebar-height)] shrink-0 items-center gap-2.5 border-b border-white/5 bg-black/10 px-3"
      style={{ paddingRight: 150 }}
    >
      {showOrb ? <CornerOrb /> : <Logo className="h-5 w-5" />}
      <span className="text-sm font-semibold tracking-tight text-ink">Jarvis</span>
      <span className="text-line-strong">/</span>
      <span className="min-w-0 truncate text-sm text-muted">{page}</span>

      <div className="ml-auto flex shrink-0 items-center gap-3 text-muted">
        <SystemStatusIcons />
        {battery && (
          <span
            className={`flex items-center gap-1 text-xs tabular-nums ${
              !battery.charging && battery.level < 0.15 ? 'text-negative' : ''
            }`}
            title={battery.charging ? 'Şarj oluyor' : 'Pil'}
          >
            <BatteryIcon level={battery.level} charging={battery.charging} />%
            {Math.round(battery.level * 100)}
          </span>
        )}
        <div className="text-right leading-tight">
          <div className="text-xs text-ink tabular-nums">
            {now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-[10px] text-faint">
            {now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' })}
          </div>
        </div>
      </div>
    </header>
  )
}

export default TitleBar
