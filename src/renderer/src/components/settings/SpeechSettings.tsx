import { useEffect, useState } from 'react'
import { CheckCircle2, Download, Loader2, Volume2 } from 'lucide-react'
import {
  SPEECH_PROVIDERS,
  type SettingsPatch,
  type SettingsView,
  type SpeechProvider,
  type TtsEngine,
  type VoicePackComponent
} from '@shared/api'
import Field from './Field'
import SecretField from './SecretField'
import Toggle from './Toggle'
import { errorMessage } from '../../lib/errors'
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '../../lib/styles'
import { useToast } from '../../lib/toast'
import { listVoiceOptions, speakText, type VoiceOption } from '../../lib/voice'
import { useVoice } from '../../lib/voiceClient'

const STT_IDS: SpeechProvider[] = ['local', 'groq', 'openai']

const TTS_OPTIONS: { id: TtsEngine; label: string; description: string }[] = [
  { id: 'piper', label: 'Jarvis sesi', description: 'Doğal Türkçe ses, internetsiz' },
  { id: 'windows', label: 'Windows sesi', description: "Windows'ta yüklü sesler" }
]

const formatMb = (bytes: number): string => `${Math.round(bytes / 1024 / 1024)} MB`

interface SpeechSettingsProps {
  settings: SettingsView
  onSettings: (settings: SettingsView) => void
  onUpdate: (patch: SettingsPatch) => Promise<void>
}

const choiceClass = (selected: boolean): string =>
  `rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
    selected ? 'border-accent bg-accent/10' : 'border-line hover:border-line-strong'
  }`

// Jarvis sesi: yerel ses paketi, "hey jarvis", konuşmayı yazıya çevirme ve cevapları okuma
function SpeechSettings({
  settings,
  onSettings,
  onUpdate
}: SpeechSettingsProps): React.JSX.Element {
  const toast = useToast()
  const voice = useVoice()
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const [installing, setInstalling] = useState(false)
  // Kaydırıcı sürüklenirken her adımda ayar yazılmasın; bırakınca kaydedilir
  const [thresholdDraft, setThresholdDraft] = useState<number | null>(null)

  const pack = voice.pack
  const installed = (id: VoicePackComponent): boolean =>
    pack?.items.find((item) => item.id === id)?.installed ?? false
  const localSttReady = installed('whisper') && installed('whisperModel')
  const piperReady = installed('piper') && installed('piperVoice')
  const wakeReady = installed('wakeword')
  const missingMb =
    pack?.items.filter((item) => !item.installed).reduce((sum, item) => sum + item.sizeMb, 0) ?? 0
  const busy = installing || Boolean(pack?.installing)
  const downloading = pack?.items.find((item) => item.id === pack.installing)
  const percent =
    pack && pack.total > 0 ? Math.min(100, Math.round((pack.received / pack.total) * 100)) : 0

  const provider = settings.sttProvider
  const providerInfo = SPEECH_PROVIDERS[provider]
  const secret = providerInfo.secret
  const threshold = thresholdDraft ?? settings.wakeWordThreshold

  // Windows sesleri bazen gecikmeli geliyor, bu yüzden voiceschanged olayı da dinleniyor
  useEffect(() => {
    const synth = window.speechSynthesis
    if (!synth) return
    const load = (): void => setVoices(listVoiceOptions(synth.getVoices()))
    const timer = setTimeout(load, 0)
    synth.addEventListener('voiceschanged', load)
    return () => {
      clearTimeout(timer)
      synth.removeEventListener('voiceschanged', load)
    }
  }, [])

  async function installPack(): Promise<void> {
    setInstalling(true)
    try {
      const status = await window.api.voice.installPack()
      if (status.installed) toast.success('Jarvis ses paketi kuruldu.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setInstalling(false)
    }
  }

  function commitThreshold(): void {
    if (thresholdDraft === null) return
    void onUpdate({ wakeWordThreshold: thresholdDraft })
    setThresholdDraft(null)
  }

  return (
    <div className="space-y-6">
      <Field
        label="Jarvis ses paketi"
        hint="İnternetsiz konuşma tanıma, doğal Türkçe ses ve “Hey Jarvis” ile uyandırma için gerekir. Dosyalar bilgisayarında kalır, ses hiçbir yere gönderilmez."
      >
        <div className={`${cardClass} divide-y divide-line`}>
          {pack ? (
            pack.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm text-ink">{item.label}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs">
                  {item.installed ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-positive" />
                      <span className="text-positive">Kurulu</span>
                    </>
                  ) : pack.installing === item.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                      <span className="text-muted">%{percent}</span>
                    </>
                  ) : (
                    <span className="text-faint">{item.sizeMb} MB</span>
                  )}
                </span>
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-faint">Yükleniyor...</div>
          )}
        </div>

        {pack && !pack.installed && (
          <div className="mt-3 space-y-2">
            {busy && downloading && (
              <div className="space-y-1.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="text-xs text-muted">
                  {downloading.label} indiriliyor: {formatMb(pack.received)} /{' '}
                  {formatMb(pack.total)}
                </p>
              </div>
            )}
            <button
              onClick={() => void installPack()}
              disabled={busy}
              className={primaryButtonClass}
            >
              <span className="inline-flex items-center gap-2">
                <Download className="h-4 w-4" />
                {busy ? 'İndiriliyor...' : `İndir ve kur (${missingMb} MB)`}
              </span>
            </button>
            {pack.error && !busy && (
              <p className="text-sm text-negative select-text">{pack.error}</p>
            )}
          </div>
        )}
      </Field>

      <Toggle
        label="“Hey Jarvis” deyince dinle"
        description={
          wakeReady
            ? 'Mikrofon açık kalır ama ses sadece bu bilgisayarda işlenir. İngilizce söyleyişle, “hey carvis” gibi söylemek en iyi sonucu verir. Küreye dokunarak da konuşabilirsin.'
            : 'Önce Jarvis ses paketini kur. Paket olmadan da Ana Sayfa’daki küreye dokunarak konuşabilirsin.'
        }
        checked={settings.wakeWordEnabled}
        disabled={!wakeReady}
        onChange={(checked) => void onUpdate({ wakeWordEnabled: checked })}
      />

      {settings.wakeWordEnabled && wakeReady && (
        <Field
          label={`Uyandırma eşiği: ${threshold.toFixed(2).replace('.', ',')}`}
          hint="Jarvis seni duymuyorsa düşür, kendiliğinden uyanıyorsa yükselt."
        >
          <input
            type="range"
            min={0.2}
            max={0.9}
            step={0.05}
            value={threshold}
            onChange={(e) => setThresholdDraft(Number(e.target.value))}
            onPointerUp={commitThreshold}
            onKeyUp={commitThreshold}
            onBlur={commitThreshold}
            className="w-full accent-accent"
          />
        </Field>
      )}

      <Toggle
        label="Konuşurken sözünü kesebileyim"
        description="Jarvis konuşurken sen konuşmaya başlarsan susup seni dinler. Hoparlörle kullanırken Jarvis kendi sesini duyup susabilir; kulaklıkla açman önerilir."
        checked={settings.voiceBargeIn}
        onChange={(checked) => void onUpdate({ voiceBargeIn: checked })}
      />

      <Field
        label="Konuşmayı yazıya çeviren servis"
        hint="Sesli sohbet ve sohbet kutusundaki mikrofon bu servisi kullanır."
      >
        <div className="grid grid-cols-3 gap-3">
          {STT_IDS.map((id) => (
            <button
              key={id}
              onClick={() => void onUpdate({ sttProvider: id })}
              disabled={id === 'local' && !localSttReady}
              className={choiceClass(id === provider)}
            >
              <div className="text-sm font-medium">{SPEECH_PROVIDERS[id].label}</div>
              <div className="mt-1 text-xs text-muted">{SPEECH_PROVIDERS[id].description}</div>
            </button>
          ))}
        </div>
        {provider === 'local' && !localSttReady && (
          <p className="mt-2 text-xs text-caution">
            Bu servis için ses paketi kurulu değil; kurulana kadar konuşma yazıya çevrilemez.
          </p>
        )}
      </Field>

      {secret && (
        <SecretField
          id={secret}
          label={`${providerInfo.label} API anahtarı`}
          saved={settings.hasSecret[secret]}
          unreadable={settings.unreadableSecrets.includes(secret)}
          description={`Mikrofonla konuşabilmek için ${providerInfo.label} anahtarı gerekir.`}
          helpUrl={providerInfo.apiKeyUrl}
          onSaved={onSettings}
        />
      )}

      <Field label="Cevapları okuyan ses">
        <div className="grid grid-cols-2 gap-3">
          {TTS_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => void onUpdate({ ttsEngine: option.id })}
              disabled={option.id === 'piper' && !piperReady}
              className={choiceClass(option.id === settings.ttsEngine)}
            >
              <div className="text-sm font-medium">{option.label}</div>
              <div className="mt-1 text-xs text-muted">
                {option.id === 'piper' && !piperReady ? 'Ses paketi gerekir' : option.description}
              </div>
            </button>
          ))}
        </div>
      </Field>

      <Toggle
        label="Yazışmada cevapları da sesli oku"
        description="Sohbette yazarak sorduğun sorulara gelen cevaplar da okunur. Sesli sohbette cevaplar her zaman okunur."
        checked={settings.speakReplies}
        onChange={(checked) => void onUpdate({ speakReplies: checked })}
      />

      {(settings.ttsEngine === 'windows' || !piperReady) && (
        <Field
          label="Windows sesi"
          hint={
            voices.length > 0
              ? "Windows'ta yüklü sesler listelenir. Türkçe ses yoksa Windows ayarlarından ekleyebilirsin."
              : 'Bu bilgisayarda ses bulunamadı.'
          }
        >
          <select
            value={settings.voiceUri}
            onChange={(e) => void onUpdate({ voiceUri: e.target.value })}
            className={inputClass}
          >
            <option value="">Otomatik (varsa Türkçe ses)</option>
            {voices.map((option) => (
              <option key={option.uri} value={option.uri}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <button
        onClick={() => speakText('Merhaba, ben Jarvis. Sana nasıl yardımcı olabilirim?')}
        className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}
      >
        <Volume2 className="h-4 w-4" />
        Sesi dene
      </button>
    </div>
  )
}

export default SpeechSettings
