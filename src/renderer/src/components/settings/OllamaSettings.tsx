import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { SettingsPatch, SettingsView } from '@shared/api'
import Field from './Field'
import { errorMessage } from '../../lib/errors'
import { inputClass } from '../../lib/styles'

interface OllamaSettingsProps {
  settings: SettingsView
  onUpdate: (patch: SettingsPatch) => Promise<void>
}

function OllamaSettings({ settings, onUpdate }: OllamaSettingsProps): React.JSX.Element {
  const [baseUrl, setBaseUrl] = useState(settings.ollamaBaseUrl)
  const [models, setModels] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const currentModel = settings.models.ollama

  const fetchModels = useCallback(
    (): Promise<void> =>
      window.api.ollama
        .listModels()
        .then(
          (list) => {
            setModels(list)
            setError(null)
          },
          (err) => {
            setModels(null)
            setError(errorMessage(err))
          }
        )
        .finally(() => setLoading(false)),
    []
  )

  useEffect(() => {
    void fetchModels()
  }, [fetchModels])

  async function loadModels(): Promise<void> {
    setLoading(true)
    await fetchModels()
  }

  // Henüz model seçilmemişse yüklü ilk modeli seç
  useEffect(() => {
    if (!currentModel && models && models.length > 0) {
      void onUpdate({ models: { ollama: models[0] } })
    }
  }, [currentModel, models, onUpdate])

  async function saveBaseUrl(): Promise<void> {
    const value = baseUrl.trim().replace(/\/+$/, '')
    if (!value || value === settings.ollamaBaseUrl) {
      setBaseUrl(settings.ollamaBaseUrl)
      return
    }
    await onUpdate({ ollamaBaseUrl: value })
    await loadModels()
  }

  return (
    <div className="space-y-4">
      <Field label="Sunucu adresi" hint="Varsayılan: http://localhost:11434">
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          onBlur={() => void saveBaseUrl()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          spellCheck={false}
          className={inputClass}
        />
      </Field>

      <Field label="Model" hint="Bilgisayarında yüklü Ollama modelleri listelenir.">
        <div className="flex gap-2">
          <select
            value={currentModel}
            onChange={(e) => void onUpdate({ models: { ollama: e.target.value } })}
            disabled={!models || models.length === 0}
            className={inputClass}
          >
            {!currentModel && <option value="">Model seç</option>}
            {currentModel && !models?.includes(currentModel) && (
              <option value={currentModel}>{currentModel} (yüklü değil)</option>
            )}
            {models?.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          <button
            onClick={() => void loadModels()}
            disabled={loading}
            aria-label="Listeyi yenile"
            title="Listeyi yenile"
            className="shrink-0 rounded-lg border border-line-strong px-3 text-ink transition-colors hover:bg-elevated disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </Field>

      {error && <p className="text-sm text-negative select-text">{error}</p>}
      {models && models.length === 0 && (
        <p className="text-sm text-muted">
          Hiç model yüklü değil. Terminalde{' '}
          <code className="rounded bg-elevated px-1.5 py-0.5 text-ink">ollama pull qwen3</code>{' '}
          komutuyla bir model indirip listeyi yenileyebilirsin.
        </p>
      )}
    </div>
  )
}

export default OllamaSettings
