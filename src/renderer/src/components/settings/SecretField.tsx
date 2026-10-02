import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react'
import type { SecretId, SettingsView } from '@shared/api'
import Field from './Field'
import { errorMessage } from '../../lib/errors'
import { useToast } from '../../lib/toast'
import { primaryButtonClass, secondaryButtonClass } from '../../lib/styles'
import { inputClass } from './styles'

interface SecretFieldProps {
  id: SecretId
  label: string
  /** Anahtar kayıtlı mı */
  saved: boolean
  /** Kayıt var ama bu bilgisayarda çözülemiyor; kullanıcı yeniden girmeli */
  unreadable?: boolean
  description?: string
  /** Boş alanda görünecek örnek metin */
  placeholder?: string
  helpUrl?: string
  onSaved: (settings: SettingsView) => void
}

// Şifreli saklanan bir API anahtarını girme, değiştirme ve silme alanı
function SecretField({
  id,
  label,
  saved,
  unreadable = false,
  description,
  placeholder,
  helpUrl,
  onSaved
}: SecretFieldProps): React.JSX.Element {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  // Boş anahtar gönderilirse kayıtlı anahtar silinir
  async function save(key: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      onSaved(await window.api.settings.setSecret(id, key))
      setValue('')
      toast.success(key.trim() ? 'Anahtar kaydedildi.' : 'Anahtar silindi.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Field
        label={label}
        hint={
          saved ? (
            <span className="inline-flex items-center gap-1 text-positive">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Anahtar kayıtlı, bu bilgisayarda şifreli saklanıyor.
            </span>
          ) : unreadable ? (
            <span className="inline-flex items-center gap-1 text-negative">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Kayıtlı anahtar bu bilgisayarda çözülemiyor. Anahtarı yeniden gir.
            </span>
          ) : (
            (description ??
            'Anahtar bu bilgisayarda şifrelenerek saklanır, hiçbir yere gönderilmez.')
          )
        }
      >
        <div className="flex flex-wrap items-start gap-2">
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) void save(value)
            }}
            placeholder={
              saved
                ? 'Değiştirmek için yenisini yapıştır'
                : (placeholder ?? 'API anahtarını yapıştır')
            }
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} basis-48 flex-1`}
          />
          <button
            onClick={() => void save(value)}
            disabled={busy || !value.trim()}
            className={primaryButtonClass}
          >
            Kaydet
          </button>
          {saved && (
            <button onClick={() => void save('')} disabled={busy} className={secondaryButtonClass}>
              Sil
            </button>
          )}
        </div>
      </Field>

      {helpUrl && (
        <a
          href={helpUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
        >
          Anahtarı nereden alırım?
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {error && <p className="text-sm text-negative select-text">{error}</p>}
    </div>
  )
}

export default SecretField
