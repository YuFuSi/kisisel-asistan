import { detailsClass, summaryClass } from './styles'
import type { SettingsPatch, SettingsView } from '@shared/api'
import Field from './Field'
import OrbSettings from './OrbSettings'
import ShortcutRecorder from './ShortcutRecorder'
import Toggle from '../ui/Toggle'

interface AppBehaviorSettingsProps {
  settings: SettingsView
  onUpdate: (patch: SettingsPatch) => Promise<void>
}

// Tepsi, Windows ile başlama ve global kısayol ayarları
function AppBehaviorSettings({ settings, onUpdate }: AppBehaviorSettingsProps): React.JSX.Element {
  return (
    <div className="space-y-6">
      <Toggle
        label="Kapatınca sistem tepsisinde çalışmaya devam et"
        description="Pencereyi kapatınca asistan arka planda çalışır ve hatırlatmalar zamanında gelir. Tamamen kapatmak için tepsi simgesine sağ tıklayıp Çıkış'ı seç."
        checked={settings.closeToTray}
        onChange={(checked) => void onUpdate({ closeToTray: checked })}
      />
      <Toggle
        label="Windows açılınca başlat"
        description={
          settings.loginItemSupported
            ? 'Bilgisayar açılınca asistan pencere açmadan tepside başlar.'
            : 'Geliştirme modunda kullanılamaz; kurulum dosyasıyla yüklenen uygulamada çalışır.'
        }
        checked={settings.openAtLogin}
        disabled={!settings.loginItemSupported}
        onChange={(checked) => void onUpdate({ openAtLogin: checked })}
      />
      <Toggle
        label="Jarvis Çentiği"
        description="Ekranın üst ortasında küçük gözlü damla: Jarvis çalışırken ne yaptığını yazar, onay gerekince başka programdayken bile oradan onaylarsın. Tam ekran oyun ve videoda gizlenir."
        checked={settings.notchEnabled}
        onChange={(checked) => void onUpdate({ notchEnabled: checked })}
      />
      <Field
        label="Hızlı açma kısayolu"
        hint="Hangi programda olursan ol, bu tuşlara basınca asistan açılır; tekrar basınca gizlenir."
      >
        <ShortcutRecorder
          value={settings.globalShortcut}
          active={settings.shortcutActive}
          onChange={(accelerator) => onUpdate({ globalShortcut: accelerator })}
        />
      </Field>
      <Field label="Jarvis küresi">
        <details className={detailsClass}>
          <summary className={summaryClass}>Görünüm ve ses efektleri</summary>
          <div className="mt-4">
            <OrbSettings />
          </div>
        </details>
      </Field>
    </div>
  )
}

export default AppBehaviorSettings
