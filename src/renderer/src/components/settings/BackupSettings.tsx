import { useCallback, useEffect, useState } from 'react'
import { Archive, FolderOpen, RotateCcw } from 'lucide-react'
import type { BackupInfo } from '@shared/api'
import Skeleton from '../ui/Skeleton'
import { errorMessage } from '../../lib/errors'
import { cardClass, secondaryButtonClass } from '../../lib/styles'
import { useToast } from '../../lib/toast'

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

const formatDate = (ms: number): string =>
  new Date(ms).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

const describeBackup = (name: string): string =>
  name.startsWith('geri-yukleme-oncesi-') ? 'Geri yükleme öncesi' : 'Günlük yedek'

// Veritabanı yedekleri (listeleme, elle yedek, geri yükleme) ve günlük klasörü
function BackupSettings(): React.JSX.Element {
  const [backups, setBackups] = useState<BackupInfo[] | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const load = useCallback((): void => {
    window.api.backups
      .list()
      .then(setBackups)
      .catch((err) => toast.error(errorMessage(err)))
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  async function createNow(): Promise<void> {
    setBusy(true)
    try {
      const info = await window.api.backups.create()
      toast.success(`Yedek alındı (${formatSize(info.size)}).`)
      load()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function restore(name: string): Promise<void> {
    try {
      // Onay penceresini ana süreç gösterir; onaylanırsa uygulama yeniden başlar
      await window.api.backups.restore(name)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function openLogs(): Promise<void> {
    try {
      await window.api.app.openLogs()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Veriler her gün otomatik olarak yedeklenir. Son 7 günün ve ondan önceki 4 haftanın yedeği
        saklanır. Bir sorun olursa günlük dosyası neyin ters gittiğini gösterir.
      </p>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => void createNow()} disabled={busy} className={secondaryButtonClass}>
          <span className="inline-flex items-center gap-2">
            <Archive className="h-4 w-4" />
            {busy ? 'Yedekleniyor...' : 'Şimdi yedekle'}
          </span>
        </button>
        <button onClick={() => void openLogs()} className={secondaryButtonClass}>
          <span className="inline-flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Günlük klasörünü aç
          </span>
        </button>
      </div>

      {backups === null ? (
        <Skeleton className="h-16 w-full" />
      ) : backups.length === 0 ? (
        <p className="text-sm text-faint">
          Henüz yedek yok. İlk otomatik yedek, uygulama açıldıktan yaklaşık bir dakika sonra alınır.
        </p>
      ) : (
        <ul className={`${cardClass} divide-y divide-line`}>
          {backups.map((backup) => (
            <li key={backup.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <div className="text-sm text-ink">{formatDate(backup.createdAt)}</div>
                <div className="text-xs text-faint">
                  {describeBackup(backup.name)} · {formatSize(backup.size)}
                </div>
              </div>
              <button onClick={() => void restore(backup.name)} className={secondaryButtonClass}>
                <span className="inline-flex items-center gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Geri yükle
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default BackupSettings
