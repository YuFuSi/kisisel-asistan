import { useState } from 'react'
import { PROVIDERS, type CloudProviderId, type SettingsPatch, type SettingsView } from '@shared/api'
import Field from './Field'
import SecretField from './SecretField'
import { inputClass } from '../../lib/styles'

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
  const [model, setModel] = useState(settings.models[provider])

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
      <SecretField
        id={provider}
        label="API anahtarı"
        saved={settings.hasSecret[provider]}
        helpUrl={info.apiKeyUrl}
        onSaved={onSettings}
      />

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
    </div>
  )
}

export default CloudSettings
