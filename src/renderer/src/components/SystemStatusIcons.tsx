import { useEffect, useState } from 'react'
import { Archive, Cpu, HardDrive, Mail, Mic, Wifi, type LucideIcon } from 'lucide-react'
import type { SystemStatus } from '@shared/api'
import Tooltip from './ui/Tooltip'
import { formatReminderTime } from '../lib/dates'
import { useClock, useMicrophoneAvailable, useOnline } from '../lib/deviceStatus'
import { type Level } from '../lib/statusLevel'

// Model ve disk bilgisi bu aralıkla yenilenir
const REFRESH_MS = 60_000
const DAY_MS = 86_400_000

interface Row {
  icon: LucideIcon
  label: string
  value: string
  level: Level
  title?: string
}

// Her şey yolundayken simgeler sessiz kalır, sorun olunca renklenir
const ICON_CLASS: Record<Level, string> = {
  ok: 'text-faint hover:text-muted',
  warn: 'text-caution',
  bad: 'text-negative',
  active: 'text-accent',
  unknown: 'text-faint'
}

const formatGb = (bytes: number): string => `${Math.round(bytes / 1024 ** 3)} GB`

function diskLevel(disk: { free: number; total: number }): Level {
  const ratio = disk.free / disk.total
  if (ratio < 0.05) return 'bad'
  return ratio < 0.1 ? 'warn' : 'ok'
}

// Pıtır'ın çalışması için gereken parçaların durumu: başlık çubuğunda sadece simge; sorun varsa renklenir
function SystemStatusIcons(): React.JSX.Element {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const online = useOnline()
  const microphone = useMicrophoneAvailable()
  const now = useClock(REFRESH_MS)

  useEffect(() => {
    let alive = true
    const load = (): void => {
      window.api.system.status().then(
        (value) => {
          if (alive) setStatus(value)
        },
        () => {}
      )
    }
    load()
    const timer = setInterval(load, REFRESH_MS)
    const unsubscribe = window.api.events.onDataChanged((scope) => {
      if (scope === 'settings') load()
    })
    return () => {
      alive = false
      clearInterval(timer)
      unsubscribe()
    }
  }, [])

  const rows: Row[] = [
    {
      icon: Mic,
      label: 'Mikrofon',
      value: microphone === null ? '...' : microphone ? 'Hazır' : 'Bulunamadı',
      level: microphone === null ? 'unknown' : microphone ? 'ok' : 'warn'
    },
    {
      icon: Wifi,
      label: 'İnternet',
      value: online ? 'Bağlı' : 'Bağlantı yok',
      level: online ? 'ok' : 'bad'
    },
    {
      icon: Cpu,
      label: 'Yapay zeka',
      value: status?.model.message ?? '...',
      level: status ? (status.model.ok ? 'ok' : 'bad') : 'unknown',
      title: status
        ? `${status.model.label} · ${status.model.model || 'model seçilmedi'}`
        : undefined
    },
    {
      icon: Mail,
      label: 'Google',
      value: status ? (status.googleConnected ? 'Bağlı' : 'Bağlı değil') : '...',
      level: status ? (status.googleConnected ? 'ok' : 'warn') : 'unknown'
    },
    {
      icon: Archive,
      label: 'Son yedek',
      value: status
        ? status.lastBackupAt
          ? formatReminderTime(status.lastBackupAt)
          : 'Henüz yok'
        : '...',
      level: status
        ? status.lastBackupAt && now.getTime() - status.lastBackupAt < 2 * DAY_MS
          ? 'ok'
          : 'warn'
        : 'unknown'
    },
    {
      icon: HardDrive,
      label: 'Depolama',
      value: status ? (status.disk ? `${formatGb(status.disk.free)} boş` : 'Okunamadı') : '...',
      level: status?.disk ? diskLevel(status.disk) : 'unknown'
    }
  ]

  // Tasarım turu: her şey yolundayken hiçbir şey gösterilmez (6 etiketsiz simge anlaşılmıyordu);
  // sadece sorun olan parçalar kısa bir yazıyla görünür. Google isteğe bağlı olduğu için bağlı
  // olmaması uyarı sayılmaz.
  const problems = rows.filter(
    (row) => (row.level === 'warn' || row.level === 'bad') && row.label !== 'Google'
  )
  if (problems.length === 0) return <></>

  return (
    <ul className="flex items-center gap-1.5">
      {problems.map(({ icon: Icon, label, value, level, title }) => (
        <li key={label}>
          <Tooltip content={title ?? `${label}: ${value}`} side="bottom">
            <span
              className={`no-drag flex h-7 items-center gap-1.5 rounded-md border border-line px-2 text-xs ${ICON_CLASS[level]}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}: {value}
            </span>
          </Tooltip>
        </li>
      ))}
    </ul>
  )
}

export default SystemStatusIcons
