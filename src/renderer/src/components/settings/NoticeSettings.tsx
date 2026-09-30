import type { SettingsPatch, SettingsView } from '@shared/api'
import { compactInputClass } from '../../lib/styles'
import Field from './Field'
import Toggle from '../ui/Toggle'

interface NoticeSettingsProps {
  settings: SettingsView
  onUpdate: (patch: SettingsPatch) => Promise<void>
}

// Hatırlatma, proaktif uyarı, pil ve rutin bildirimlerinin Jarvis'in sesiyle gelmesi
function NoticeSettings({ settings, onUpdate }: NoticeSettingsProps): React.JSX.Element {
  return (
    <div className="space-y-6">
      <Toggle
        label="Uyarıları sesli söylesin"
        description="Hatırlatmalar, pil uyarısı, bitmiş rutinler ve Jarvis'in fark ettiği şeyler bildirimin yanında Jarvis'in sesiyle de gelir. Küre ve çentik her uyarıda nabız atar."
        checked={settings.noticesSpoken}
        onChange={(checked) => void onUpdate({ noticesSpoken: checked })}
      />

      <div className="grid grid-cols-[auto_auto_1fr] items-end gap-4">
        <Field label="Sessiz saatler başlangıç">
          <input
            type="time"
            value={settings.quietStart}
            disabled={!settings.noticesSpoken}
            onChange={(e) => {
              if (e.target.value) void onUpdate({ quietStart: e.target.value })
            }}
            aria-label="Sessiz saatler başlangıcı"
            className={`${compactInputClass} w-32`}
          />
        </Field>
        <Field label="Bitiş">
          <input
            type="time"
            value={settings.quietEnd}
            disabled={!settings.noticesSpoken}
            onChange={(e) => {
              if (e.target.value) void onUpdate({ quietEnd: e.target.value })
            }}
            aria-label="Sessiz saatler bitişi"
            className={`${compactInputClass} w-32`}
          />
        </Field>
        <p className="pb-2 text-xs text-muted">Bu aralıkta uyarılar sadece yazılı gelir.</p>
      </div>
    </div>
  )
}

export default NoticeSettings
