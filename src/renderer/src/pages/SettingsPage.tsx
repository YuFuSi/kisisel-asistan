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
import NoticeSettings from '../components/settings/NoticeSettings'
import AssistantSettings from '../components/settings/AssistantSettings'
import BackupSettings from '../components/settings/BackupSettings'
import ActivityList from '../components/activity/ActivityList'
import PageLayout from '../components/ui/PageLayout'
import Skeleton from '../components/ui/Skeleton'
import Tabs from '../components/ui/Tabs'
import { errorMessage } from '../lib/errors'
import { sectionTitleClass } from '../lib/styles'
import { useToast } from '../lib/toast'

type Tab = 'model' | 'asistan' | 'ses' | 'servisler' | 'google' | 'uygulama'

const TABS: { id: Tab; label: string }[] = [
  { id: 'uygulama', label: 'Temel tercihler' },
  { id: 'model', label: 'Model' },
  { id: 'asistan', label: 'Asistan' },
  { id: 'ses', label: 'Ses' },
  { id: 'servisler', label: 'Servisler' },
  { id: 'google', label: 'Google' }
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
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('uygulama')
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
      <PageLayout title="Ayarlar">
        <div className="space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </PageLayout>
    )
  }

  const provider = settings.provider

  return (
    <PageLayout title="Ayarlar" tabs={<Tabs items={TABS} value={tab} onChange={setTab} />}>
      <div className="animate-fade space-y-8">
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

            <details className="rounded-control border border-line p-3">
              <summary className="min-h-8 cursor-pointer text-sm text-muted">
                İleri · bağlantı testi
              </summary>
              <Section title="Bağlantı testi">
                <ConnectionTest key={`${provider}:${settings.models[provider]}`} />
              </Section>
            </details>
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
              unreadable={settings.unreadableSecrets.includes('tavily')}
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
            <Section title="Jarvis'in uyarıları">
              <NoticeSettings settings={settings} onUpdate={update} />
            </Section>
            <Section title="Sabah özeti">
              <BriefSettings settings={settings} onUpdate={update} />
            </Section>
            <details
              onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
              className="rounded-control border border-line p-3"
            >
              <summary className="min-h-8 cursor-pointer text-sm text-muted">
                İleri ayarlar · yedekler ve işlem kayıtları
              </summary>
              {advancedOpen && (
                <div className="mt-4 space-y-6">
                  <Section title="Yedekler ve günlükler">
                    <BackupSettings />
                  </Section>
                  <Section title="Son işlemler">
                    <ActivityList />
                  </Section>
                </div>
              )}
            </details>
          </>
        )}
      </div>
    </PageLayout>
  )
}

export default SettingsPage
