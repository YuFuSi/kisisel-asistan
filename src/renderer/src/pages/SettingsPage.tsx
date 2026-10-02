import { useCallback, useEffect, useState } from 'react'
import { MotionConfig, motion } from 'motion/react'
import {
  Archive,
  Bell,
  Bot,
  Clock,
  Globe,
  History,
  Link,
  Mic,
  Monitor,
  Settings2,
  Sparkles,
  Shirt,
  type LucideIcon
} from 'lucide-react'
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
import WardrobeSettings from '../components/settings/WardrobeSettings'
import IconTile, { type IconTone } from '../components/ui/IconTile'
import { choiceClass, detailsClass, summaryClass } from '../components/settings/styles'
import { useReducedMotion } from '../lib/useReducedMotion'
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
  icon,
  tone = 'lilac',
  children
}: {
  title: string
  icon: LucideIcon
  tone?: IconTone
  children: React.ReactNode
}): React.JSX.Element {
  const reduced = useReducedMotion()
  return (
    <motion.section
      layout={!reduced}
      initial={false}
      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      className="glass min-w-0 space-y-5 p-5 sm:p-6"
    >
      <h2 className="flex items-center gap-3 text-base font-semibold text-ink">
        <IconTile icon={icon} tone={tone} size={30} />
        {title}
      </h2>
      <div className="min-w-0">{children}</div>
    </motion.section>
  )
}

function SettingsPage(): React.JSX.Element {
  const reduced = useReducedMotion()
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
      <PageLayout title="Ayarlar" reduceMotion={reduced}>
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
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <PageLayout
        title="Ayarlar"
        reduceMotion={reduced}
        tabs={<Tabs items={TABS} value={tab} onChange={setTab} />}
      >
        <div className="space-y-5 pb-2">
          {tab === 'model' && (
            <>
              <Section title="Yapay zeka sağlayıcısı" icon={Bot}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {PROVIDER_IDS.map((id) => (
                    <motion.button
                      key={id}
                      onClick={() => void update({ provider: id })}
                      aria-pressed={id === provider}
                      layout={!reduced}
                      whileHover={reduced ? undefined : { y: -2 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                      className={choiceClass(id === provider)}
                    >
                      <div className="text-sm font-medium">{PROVIDERS[id].label}</div>
                      <div className="mt-1 text-xs text-muted">{PROVIDERS[id].description}</div>
                    </motion.button>
                  ))}
                </div>
              </Section>

              <Section title={`${PROVIDERS[provider].label} ayarları`} icon={Settings2}>
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

              <details className={detailsClass}>
                <summary className={summaryClass}>İleri · bağlantı testi</summary>
                <div className="mt-4">
                  <Section title="Bağlantı testi" icon={Link} tone="teal">
                    <ConnectionTest key={`${provider}:${settings.models[provider]}`} />
                  </Section>
                </div>
              </details>
            </>
          )}

          {tab === 'asistan' && (
            <Section title="Kişiselleştirme ve model ayarları" icon={Sparkles} tone="pink">
              <AssistantSettings settings={settings} onUpdate={update} />
            </Section>
          )}

          {tab === 'ses' && (
            <Section title="Sesli komut ve sesli yanıt" icon={Mic}>
              <SpeechSettings settings={settings} onSettings={setSettings} onUpdate={update} />
            </Section>
          )}

          {tab === 'servisler' && (
            <Section title="İnternette arama" icon={Globe} tone="teal">
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
            <Section title="Google hesabı (Gmail ve Takvim)" icon={Link} tone="blue">
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
              <Section title="Pencere ve kısayollar" icon={Monitor} tone="teal">
                <AppBehaviorSettings settings={settings} onUpdate={update} />
              </Section>
              <Section title="Kıyafet dolabı" icon={Shirt} tone="pink">
                <WardrobeSettings />
              </Section>
              <Section title="Pıtır'ın uyarıları" icon={Bell} tone="amber">
                <NoticeSettings settings={settings} onUpdate={update} />
              </Section>
              <Section title="Sabah özeti" icon={Clock} tone="blue">
                <BriefSettings settings={settings} onUpdate={update} />
              </Section>
              <details
                onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
                className={detailsClass}
              >
                <summary className={summaryClass}>
                  İleri ayarlar · yedekler ve işlem kayıtları
                </summary>
                {advancedOpen && (
                  <div className="mt-4 space-y-6">
                    <Section title="Yedekler ve günlükler" icon={Archive} tone="blue">
                      <BackupSettings />
                    </Section>
                    <Section title="Son işlemler" icon={History} tone="teal">
                      <ActivityList glass />
                    </Section>
                  </div>
                )}
              </details>
            </>
          )}
        </div>
      </PageLayout>
    </MotionConfig>
  )
}

export default SettingsPage
