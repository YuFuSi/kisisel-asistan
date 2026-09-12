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
import GoogleSettings from '../components/settings/GoogleSettings'
import SpeechSettings from '../components/settings/SpeechSettings'
import SecretField from '../components/settings/SecretField'
import BriefSettings from '../components/settings/BriefSettings'
import AssistantSettings from '../components/settings/AssistantSettings'
import Skeleton from '../components/ui/Skeleton'
import { errorMessage } from '../lib/errors'
import { sectionTitleClass, tabClass } from '../lib/styles'
import { useToast } from '../lib/toast'

type Tab = 'model' | 'asistan' | 'ses' | 'servisler' | 'google' | 'uygulama'

const TABS: { id: Tab; label: string }[] = [
  { id: 'model', label: 'Model' },
  { id: 'asistan', label: 'Asistan' },
  { id: 'ses', label: 'Ses' },
  { id: 'servisler', label: 'Servisler' },
  { id: 'google', label: 'Google' },
  { id: 'uygulama', label: 'Uygulama' }
]

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
  const [tab, setTab] = useState<Tab>('model')
  const toast = useToast()

  // İlk yükleme; ayar başka yerden değişirse (ör. tepsi menüsü) yeniden yükle
  useEffect(() => {
    const load = (): void => {
      window.api.settings
        .get()
        .then(setSettings)
        .catch((err) => toast.error(errorMessage(err)))
      window.api.google
        .status()
        .then(setGoogleStatus)
        .catch((err) => toast.error(errorMessage(err)))
    }
    load()
    return window.api.events.onDataChanged((scope) => {
      if (scope === 'settings') load()
    })
  }, [toast])

  const update = useCallback(
    async (patch: SettingsPatch): Promise<void> => {
      try {
        setSettings(await window.api.settings.update(patch))
      } catch (err) {
        toast.error(errorMessage(err))
      }
    },
    [toast]
  )

  if (!settings) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  const provider = settings.provider

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold tracking-tight">Ayarlar</h1>

      <div className="mt-4 flex gap-1 border-b border-line">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={tabClass(tab === item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="animate-fade space-y-8 py-6">
        {tab === 'model' && (
          <>
            <Section title="Yapay zeka sağlayıcısı">
              <div className="grid grid-cols-2 gap-3">
                {PROVIDER_IDS.map((id) => (
                  <button
                    key={id}
                    onClick={() => void update({ provider: id })}
                    className={`rounded-card border p-4 text-left transition-colors ${
                      id === provider
                        ? 'border-accent bg-accent/10'
                        : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <div className="text-sm font-medium">{PROVIDERS[id].label}</div>
                    <div className="mt-1 text-xs text-muted">{PROVIDERS[id].description}</div>
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
          </>
        )}

        {tab === 'asistan' && (
          <Section title="Kişiselleştirme ve model ayarları">
            <AssistantSettings settings={settings} onUpdate={update} />
          </Section>
        )}

        {tab === 'ses' && (
          <Section title="Sesli komut ve sesli yanıt">
            <SpeechSettings settings={settings} onSettings={setSettings} onUpdate={update} />
          </Section>
        )}

        {tab === 'servisler' && (
          <Section title="İnternette arama">
            <SecretField
              id="tavily"
              label="Tavily API anahtarı"
              saved={settings.hasSecret.tavily}
              description="Asistanın internette arama yapabilmesi için gerekir. tavily.com ücretsiz anahtar veriyor."
              placeholder="Örn. tvly-..."
              helpUrl="https://app.tavily.com/home"
              onSaved={setSettings}
            />
          </Section>
        )}

        {tab === 'google' && (
          <Section title="Google hesabı (Gmail ve Takvim)">
            <GoogleSettings
              settings={settings}
              status={googleStatus}
              onSettings={setSettings}
              onStatus={setGoogleStatus}
            />
          </Section>
        )}

        {tab === 'uygulama' && (
          <>
            <Section title="Pencere ve kısayollar">
              <AppBehaviorSettings settings={settings} onUpdate={update} />
            </Section>
            <Section title="Sabah özeti">
              <BriefSettings settings={settings} onUpdate={update} />
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

export default SettingsPage
