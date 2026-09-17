import { useState } from 'react'
import type { SettingsPatch, SettingsView } from '@shared/api'
import { errorMessage } from '../../lib/errors'
import { compactInputClass, inputClass, secondaryButtonClass } from '../../lib/styles'
import { useToast } from '../../lib/toast'
import Field from './Field'
import Toggle from '../ui/Toggle'

interface BriefSettingsProps {
  settings: SettingsView
  onUpdate: (patch: SettingsPatch) => Promise<void>
}

// Her sabah hava, görevler, takvim ve e-posta özetini bildirimle gösterme ayarları
function BriefSettings({ settings, onUpdate }: BriefSettingsProps): React.JSX.Element {
  const [city, setCity] = useState(settings.briefCity)
  const [testing, setTesting] = useState(false)
  const toast = useToast()

  async function preview(): Promise<void> {
    setTesting(true)
    try {
      await window.api.brief.preview()
      toast.success('Özet bildirimi gönderildi.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Toggle
        label="Her gün sabah özeti göster"
        description="Belirlediğin saatte hava durumu, bekleyen görevler, bugünkü takvim ve okunmamış e-posta sayısı bildirim olarak gelir. Bildirime tıklayınca asistan ayrıntılı özeti yazar."
        checked={settings.briefEnabled}
        onChange={(checked) => void onUpdate({ briefEnabled: checked })}
      />

      <Toggle
        label="Sesli de okusun"
        description="Bildirimle birlikte Jarvis özeti kendiliğinden sesli okur; tıklamana gerek kalmaz."
        checked={settings.briefSpoken}
        onChange={(checked) => void onUpdate({ briefSpoken: checked })}
      />

      <div className="grid grid-cols-[auto_1fr] gap-4">
        <Field label="Saat" hint="Uygulama o saatte kapalıysa açılınca gösterilir.">
          <input
            type="time"
            value={settings.briefTime}
            onChange={(e) => {
              if (e.target.value) void onUpdate({ briefTime: e.target.value })
            }}
            aria-label="Sabah özeti saati"
            className={`${compactInputClass} w-32`}
          />
        </Field>
        <Field label="Hava durumu için şehir" hint="Boş bırakırsan özette hava durumu olmaz.">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onBlur={() => {
              if (city.trim() !== settings.briefCity) void onUpdate({ briefCity: city })
            }}
            placeholder="Örn. İstanbul"
            className={inputClass}
          />
        </Field>
      </div>

      <button onClick={() => void preview()} disabled={testing} className={secondaryButtonClass}>
        {testing ? 'Hazırlanıyor...' : 'Şimdi dene'}
      </button>
    </div>
  )
}

export default BriefSettings
