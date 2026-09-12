import { useCallback, useEffect, useState } from 'react'
import {
  PROVIDER_IDS,
  PROVIDERS,
  type GoogleStatus,
  type SettingsPatch,
  type SettingsView
} from '@shared/api'
import OllamaSettings from '../components/settings/OllamaSettings'
import CloudSettings from '../components/settings/CloudSettings'
import ConnectionTest from '../components/settings/ConnectionTest'
import AppBehaviorSettings from '../components/settings/AppBehaviorSettings'
import SecretField from '../components/settings/SecretField'
import GoogleSettings from '../components/settings/GoogleSettings'
import { errorMessage } from '../lib/errors'
import { sectionTitleClass } from '../lib/styles'

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="space-y-3">
      <h2 className={sectionTitleClass}>{title}</h2>
      {children}
    </section>
  )
}

function SettingsPage(): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsView | null>(null)
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  // İlk yükleme; ayar başka yerden değişirse (ör. tepsi menüsü) yeniden yükle
  useEffect(() => {
    const load = (): void => {
      window.api.settings
        .get()
        .then(setSettings)
        .catch((err) => setError(errorMessage(err)))
      window.api.google
        .status()
        .then(setGoogleStatus)
        .catch((err) => setError(errorMessage(err)))
    }
    load()
    return window.api.events.onDataChanged((scope) => {
      if (scope === 'settings') load()
    })
  }, [])

  const update = useCallback(async (patch: SettingsPatch): Promise<void> => {
    setError(null)
    try {
      setSettings(await window.api.settings.update(patch))
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [])

  if (!settings) {
    return <div className="p-8 text-sm text-zinc-500">{error ?? 'Yükleniyor...'}</div>
  }

  const provider = settings.provider

  return (
    <div className="mx-auto max-w-2xl space-y-10 p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ayarlar</h1>
        <p className="mt-1 text-sm text-zinc-400">Yapay zeka modeli ve uygulama tercihleri</p>
      </div>

      <Section title="Yapay zeka sağlayıcısı">
        <div className="grid grid-cols-2 gap-3">
          {PROVIDER_IDS.map((id) => (
            <button
              key={id}
              onClick={() => void update({ provider: id })}
              className={`rounded-xl border p-4 text-left transition-colors ${
                id === provider
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="text-sm font-medium">{PROVIDERS[id].label}</div>
              <div className="mt-1 text-xs text-zinc-400">{PROVIDERS[id].description}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title={`${PROVIDERS[provider].label} ayarları`}>
        {provider === 'ollama' ? (
          <OllamaSettings settings={settings} onUpdate={update} />
        ) : (
          <CloudSettings
            key={provider}
            provider={provider}
            settings={settings}
            onSettings={setSettings}
            onUpdate={update}
          />
        )}
      </Section>

      <Section title="Bağlantı testi">
        <ConnectionTest key={`${provider}:${settings.models[provider]}`} />
      </Section>

      <Section title="Servisler">
        <SecretField
          id="tavily"
          label="Tavily API anahtarı"
          saved={settings.hasSecret.tavily}
          description="Asistanın internette arama yapabilmesi için gerekir. tavily.com ücretsiz anahtar veriyor."
          helpUrl="https://app.tavily.com/home"
          onSaved={setSettings}
        />
      </Section>

      <Section title="Google hesabı (Gmail ve Takvim)">
        <GoogleSettings
          settings={settings}
          status={googleStatus}
          onSettings={setSettings}
          onStatus={setGoogleStatus}
        />
      </Section>

      <Section title="Uygulama">
        <AppBehaviorSettings settings={settings} onUpdate={update} />
      </Section>

      {error && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300 select-text">
          {error}
        </div>
      )}
    </div>
  )
}

export default SettingsPage
