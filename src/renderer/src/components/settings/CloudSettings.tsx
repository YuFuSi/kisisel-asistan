import { useState } from 'react'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { PROVIDERS, type CloudProviderId, type SettingsPatch, type SettingsView } from '@shared/api'
import Field from './Field'
import { errorMessage } from '../../lib/errors'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../../lib/styles'

interface CloudSettingsProps {
  provider: CloudProviderId
  settings: SettingsView
  onSettings: (settings: SettingsView) => void
  onUpdate: (patch: SettingsPatch) => Promise<void>
}

function CloudSettings({
  provider,
  settings,
  onSettings,
  onUpdate
}: CloudSettingsProps): React.JSX.Element {
  const info = PROVIDERS[provider]
  const hasKey = settings.hasApiKey[provider]
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(settings.models[provider])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Boş değer anahtarı siler
  async function saveKey(value: string): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      onSettings(await window.api.settings.setApiKey(provider, value))
      setApiKey('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function saveModel(): Promise<void> {
    const value = model.trim()
    if (!value || value === settings.models[provider]) {
      setModel(settings.models[provider])
      return
    }
    await onUpdate({ models: { [provider]: value } })
  }

  return (
    <div className="space-y-4">
      <Field
        label="API anahtarı"
        hint={
          hasKey ? (
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Anahtar kayıtlı, bu bilgisayarda şifreli saklanıyor.
            </span>
          ) : (
            'Anahtar bu bilgisayarda şifrelenerek saklanır, hiçbir yere gönderilmez.'
          )
        }
      >
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && apiKey.trim()) void saveKey(apiKey)
            }}
            placeholder={
              hasKey ? 'Değiştirmek için yeni anahtarı yapıştır' : 'API anahtarını yapıştır'
            }
            autoComplete="off"
            spellCheck={false}
            className={inputClass}
          />
          <button
            onClick={() => void saveKey(apiKey)}
            disabled={saving || !apiKey.trim()}
            className={primaryButtonClass}
          >
            Kaydet
          </button>
          {hasKey && (
            <button
              onClick={() => void saveKey('')}
              disabled={saving}
              className={secondaryButtonClass}
            >
              Sil
            </button>
          )}
        </div>
      </Field>

      {info.apiKeyUrl && (
        <a
          href={info.apiKeyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
        >
          Anahtarı nereden alırım?
          <ExternalLink className="h-3 w-3" />
        </a>
      )}

      <Field label="Model" hint={`Örnek: ${info.defaultModel}`}>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          onBlur={() => void saveModel()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          spellCheck={false}
          className={inputClass}
        />
      </Field>

      {error && <p className="text-sm text-red-400 select-text">{error}</p>}
    </div>
  )
}

export default CloudSettings
