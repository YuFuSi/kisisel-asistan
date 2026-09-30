import { useState } from 'react'
import {
  CONTEXT_LENGTHS,
  DEFAULT_OLLAMA_CONTEXT,
  TONE_LABELS,
  type AssistantTone,
  type SettingsPatch,
  type SettingsView
} from '@shared/api'
import { compactInputClass, inputClass } from '../../lib/styles'
import Field from './Field'
import Toggle from '../ui/Toggle'

interface AssistantSettingsProps {
  settings: SettingsView
  onUpdate: (patch: SettingsPatch) => Promise<void>
}

const ABOUT_ME_LIMIT = 1500

// Yaratıcılık seçenekleri; boş değer modelin kendi varsayılanı demek
const TEMPERATURES: { value: number | null; label: string }[] = [
  { value: null, label: 'Model varsayılanı' },
  { value: 0.2, label: 'Tutarlı (0,2)' },
  { value: 0.7, label: 'Dengeli (0,7)' },
  { value: 1.1, label: 'Yaratıcı (1,1)' }
]

const TONE_OPTIONS = Object.entries(TONE_LABELS) as [AssistantTone, string][]

// Hakkımda metni, konuşma tonu ve model ayarları
function AssistantSettings({ settings, onUpdate }: AssistantSettingsProps): React.JSX.Element {
  const [aboutMe, setAboutMe] = useState(settings.aboutMe)
  const isOllama = settings.provider === 'ollama'

  return (
    <div className="space-y-6">
      <Field
        label="Hakkımda"
        hint={`Asistan bu metni her sohbette bilir: adın, işin, ilgi alanların, nasıl yardım istediğin gibi. ${aboutMe.length}/${ABOUT_ME_LIMIT}`}
      >
        <textarea
          value={aboutMe}
          maxLength={ABOUT_ME_LIMIT}
          rows={5}
          onChange={(e) => setAboutMe(e.target.value)}
          onBlur={() => {
            if (aboutMe.trim() !== settings.aboutMe) void onUpdate({ aboutMe })
          }}
          placeholder="Örn. Adım Yusuf. Yazılım öğreniyorum. Cevapları adım adım ve sade Türkçe isterim."
          className={`${inputClass} resize-y leading-6`}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Konuşma tonu">
          <select
            value={settings.tone}
            onChange={(e) => void onUpdate({ tone: e.target.value as AssistantTone })}
            className={inputClass}
          >
            {TONE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Yaratıcılık"
          hint="Düşük değer daha tutarlı, yüksek değer daha çeşitli cevap verir."
        >
          <select
            value={settings.temperature === null ? '' : String(settings.temperature)}
            onChange={(e) =>
              void onUpdate({ temperature: e.target.value === '' ? null : Number(e.target.value) })
            }
            className={inputClass}
          >
            {TEMPERATURES.map((option) => (
              <option key={option.label} value={option.value === null ? '' : String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <details className="rounded-control border border-line p-3">
        <summary className="min-h-8 cursor-pointer text-sm text-muted">
          İleri model ayarları
        </summary>
        <div className="mt-4 space-y-6">
          <Field
            label="Bağlam uzunluğu (Ollama)"
            hint={
              isOllama
                ? 'Modelin aynı anda aklında tutabildiği metin miktarı. Uzun sohbet ve belgelerde artır; daha fazla ekran kartı belleği kullanır ve yavaşlatabilir.'
                : 'Sadece Ollama modellerinde kullanılır; bulut modelleri kendi sınırlarını kullanır.'
            }
          >
            <select
              value={settings.contextLength === null ? '' : String(settings.contextLength)}
              disabled={!isOllama}
              onChange={(e) =>
                void onUpdate({
                  contextLength: e.target.value === '' ? null : Number(e.target.value)
                })
              }
              className={`${compactInputClass} w-56`}
            >
              <option value="">
                Önerilen ({DEFAULT_OLLAMA_CONTEXT.toLocaleString('tr-TR')} token)
              </option>
              {CONTEXT_LENGTHS.map((length) => (
                <option key={length} value={String(length)}>
                  {length.toLocaleString('tr-TR')} token
                </option>
              ))}
            </select>
          </Field>

          <Toggle
            label="Anlamsal arama (bge-m3)"
            description="Hafıza ve notlarda anahtar kelime yerine anlam benzerliğine göre arama yapar; farklı kelimelerle sorduğunda da ilgili kaydı bulur. Ollama'da bge-m3 modelinin indirilmiş olması gerekir (terminalde: ollama pull bge-m3)."
            checked={settings.semanticSearchEnabled}
            onChange={(checked) => void onUpdate({ semanticSearchEnabled: checked })}
          />
        </div>
      </details>
    </div>
  )
}

export default AssistantSettings
