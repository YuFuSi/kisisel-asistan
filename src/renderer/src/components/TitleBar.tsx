import {
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Wifi,
  WifiOff
} from 'lucide-react'
import Logo from './jarvis/Logo'
import { useBattery, useClock, useOnline, type BatteryInfo } from '../lib/deviceStatus'

interface TitleBarProps {
  /** O an açık olan sayfanın adı */
  page: string
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
function TitleBar({ page }: TitleBarProps): React.JSX.Element {
  const now = useClock()
  const online = useOnline()
  const battery = useBattery()

  return (
    <header
      className="drag-region flex h-[var(--titlebar-height)] shrink-0 items-center gap-2.5 border-b border-line bg-app px-3"
      style={{ paddingRight: 150 }}
    >
      <Logo className="h-5 w-5" />
      <span className="text-[13px] font-semibold tracking-[0.3em] text-ink">JARVIS</span>
      <span className="text-faint">·</span>
      <span className="min-w-0 truncate text-sm text-muted">{page}</span>

      <div className="ml-auto flex shrink-0 items-center gap-3 text-muted">
        <span title={online ? 'İnternet bağlı' : 'İnternet bağlantısı yok'}>
          {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4 text-caution" />}
        </span>
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
