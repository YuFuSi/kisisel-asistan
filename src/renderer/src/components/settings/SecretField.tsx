import { useState } from 'react'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import type { SecretId, SettingsView } from '@shared/api'
import Field from './Field'
import { errorMessage } from '../../lib/errors'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../../lib/styles'

interface SecretFieldProps {
  id: SecretId
  label: string
  /** Anahtar kayıtlı mı */
  saved: boolean
  description?: string
  helpUrl?: string
  onSaved: (settings: SettingsView) => void
}

// Şifreli saklanan bir API anahtarını girme, değiştirme ve silme alanı
function SecretField({
  id,
  label,
  saved,
  description,
  helpUrl,
  onSaved
}: SecretFieldProps): React.JSX.Element {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Boş anahtar gönderilirse kayıtlı anahtar silinir
  async function save(key: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      onSaved(await window.api.settings.setSecret(id, key))
      setValue('')
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
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Anahtar kayıtlı, bu bilgisayarda şifreli saklanıyor.
            </span>
          ) : (
            (description ??
            'Anahtar bu bilgisayarda şifrelenerek saklanır, hiçbir yere gönderilmez.')
          )
        }
      >
        <div className="flex gap-2">
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) void save(value)
            }}
            placeholder={
              saved ? 'Değiştirmek için yeni anahtarı yapıştır' : 'API anahtarını yapıştır'
            }
            autoComplete="off"
            spellCheck={false}
            className={inputClass}
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
          className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
        >
          Anahtarı nereden alırım?
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {error && <p className="text-sm text-red-400 select-text">{error}</p>}
    </div>
  )
}

export default SecretField
