import { useEffect, useState } from 'react'
import { Activity, Archive, Cpu, HardDrive, Mail, Mic, Wifi, type LucideIcon } from 'lucide-react'
import type { SystemStatus } from '@shared/api'
import HomeCard from './HomeCard'
import { StatusDot } from '../ui/Badge'
import Tooltip from '../ui/Tooltip'
import { formatReminderTime } from '../../lib/dates'
import { useClock, useMicrophoneAvailable, useOnline } from '../../lib/deviceStatus'
import { LEVEL_TEXT_CLASS, type Level } from '../../lib/statusLevel'

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

const formatGb = (bytes: number): string => `${Math.round(bytes / 1024 ** 3)} GB`

function diskLevel(disk: { free: number; total: number }): Level {
  const ratio = disk.free / disk.total
  if (ratio < 0.05) return 'bad'
  return ratio < 0.1 ? 'warn' : 'ok'
}

// Jarvis'in çalışması için gereken parçaların durumu
function SystemStatusCard(): React.JSX.Element {
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

  return (
    <HomeCard title="Sistem durumu" icon={Activity}>
      <ul className="space-y-2.5">
        {rows.map(({ icon: Icon, label, value, level, title }) => {
          const labelRow = (
            <>
              <Icon className="h-4 w-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-ink">{label}</span>
            </>
          )
          return (
            <li key={label} className="flex items-center gap-3 text-sm">
              {title ? (
                <Tooltip content={title} side="bottom">
                  <span className="flex min-w-0 flex-1 items-center gap-3">{labelRow}</span>
                </Tooltip>
              ) : (
                labelRow
              )}
              <span className={`truncate text-xs ${LEVEL_TEXT_CLASS[level]}`}>{value}</span>
              <StatusDot level={level} />
            </li>
          )
        })}
      </ul>
    </HomeCard>
  )
}

export default SystemStatusCard
