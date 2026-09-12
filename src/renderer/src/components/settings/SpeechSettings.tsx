import { useEffect, useState } from 'react'
import { Volume2 } from 'lucide-react'
import {
  SPEECH_PROVIDERS,
  type SettingsPatch,
  type SettingsView,
  type SpeechProvider
} from '@shared/api'
import Field from './Field'
import SecretField from './SecretField'
import Toggle from './Toggle'
import { listVoiceOptions, speakText, type VoiceOption } from '../../lib/voice'
import { inputClass, secondaryButtonClass } from '../../lib/styles'

const PROVIDER_IDS: SpeechProvider[] = ['groq', 'openai']

interface SpeechSettingsProps {
  settings: SettingsView
  onSettings: (settings: SettingsView) => void
  onUpdate: (patch: SettingsPatch) => Promise<void>
}

// Sesli komut (konuşmayı yazıya çevirme) ve cevapların sesli okunması
function SpeechSettings({
  settings,
  onSettings,
  onUpdate
}: SpeechSettingsProps): React.JSX.Element {
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const provider = settings.sttProvider
  const info = SPEECH_PROVIDERS[provider]

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

  return (
    <div className="space-y-5">
      <Field
        label="Konuşmayı yazıya çeviren servis"
        hint="Sohbet kutusundaki mikrofon butonu bu servisi kullanır."
      >
        <div className="grid grid-cols-2 gap-3">
          {PROVIDER_IDS.map((id) => (
            <button
              key={id}
              onClick={() => void onUpdate({ sttProvider: id })}
              className={`rounded-xl border p-3 text-left transition-colors ${
                id === provider
                  ? 'border-accent bg-accent/10'
                  : 'border-line hover:border-line-strong'
              }`}
            >
              <div className="text-sm font-medium">{SPEECH_PROVIDERS[id].label}</div>
              <div className="mt-1 text-xs text-muted">{SPEECH_PROVIDERS[id].description}</div>
            </button>
          ))}
        </div>
      </Field>

      <SecretField
        id={info.secret}
        label={`${info.label} API anahtarı`}
        saved={settings.hasSecret[info.secret]}
        description={`Mikrofonla konuşabilmek için ${info.label} anahtarı gerekir.`}
        helpUrl={info.apiKeyUrl}
        onSaved={onSettings}
      />

      <Toggle
        label="Cevapları sesli oku"
        description="Asistanın yazdığı cevap, Windows'un sesiyle okunur. Ek anahtar veya internet gerekmez."
        checked={settings.speakReplies}
        onChange={(checked) => void onUpdate({ speakReplies: checked })}
      />

      <Field
        label="Okuma sesi"
        hint={
          voices.length > 0
            ? "Windows'ta yüklü sesler listelenir. Türkçe ses yoksa Windows ayarlarından ekleyebilirsin."
            : 'Bu bilgisayarda ses bulunamadı.'
        }
      >
        <div className="flex gap-2">
          <select
            value={settings.voiceUri}
            onChange={(e) => void onUpdate({ voiceUri: e.target.value })}
            className={inputClass}
          >
            <option value="">Otomatik (varsa Türkçe ses)</option>
            {voices.map((voice) => (
              <option key={voice.uri} value={voice.uri}>
                {voice.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => speakText('Merhaba, ben kişisel asistanın.', settings.voiceUri)}
            className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}
          >
            <Volume2 className="h-4 w-4" />
            Dene
          </button>
        </div>
      </Field>
    </div>
  )
}

export default SpeechSettings
