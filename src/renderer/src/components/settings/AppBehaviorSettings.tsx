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
        label="Masaüstü arkadaş"
        description="Jarvis robotu görev çubuğunun üstünde yaşar: onay ister, iş bitince haber verir, ne yaptığına göre arada yorum yapar (video izlerken yanına gelir). Sadece pencere başlığına bakar, ekran görüntüsü almaz. Açıkken çentik gösterilmez. Kısayol: Ctrl+Shift+J."
        checked={settings.companionEnabled}
        onChange={(checked) => void onUpdate({ companionEnabled: checked })}
      />
      {settings.companionEnabled && (
        <Field
          label="Konuşkanlık"
          hint="Robotun kendiliğinden ne sıklıkla yorum yapacağı. Onaylar ve iş bitti haberleri her zaman gelir; sessiz saatlerde, toplantıda ve tam ekran oyunda susar."
        >
          <div className="flex gap-2">
            {(
              [
                ['quiet', 'Sessiz'],
                ['sometimes', 'Ara sıra'],
                ['chatty', 'Geveze']
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => void onUpdate({ companionChattiness: id })}
                aria-pressed={settings.companionChattiness === id}
                className={`rounded-[10px] border px-3 py-1.5 text-sm transition-colors ${
                  settings.companionChattiness === id
                    ? 'border-accent bg-accent/15 text-ink'
                    : 'border-line text-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
      )}
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
