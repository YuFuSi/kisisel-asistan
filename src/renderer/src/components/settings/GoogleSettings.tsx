import { useState } from 'react'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import type { GoogleStatus, SettingsView } from '@shared/api'
import SecretField from './SecretField'
import { errorMessage } from '../../lib/errors'
import { primaryButtonClass, secondaryButtonClass } from '../../lib/styles'

interface GoogleSettingsProps {
  settings: SettingsView
  status: GoogleStatus | null
  onSettings: (settings: SettingsView) => void
  onStatus: (status: GoogleStatus) => void
}

// Gmail ve Takvim için Google hesabı bağlama
function GoogleSettings({
  settings,
  status,
  onSettings,
  onStatus
}: GoogleSettingsProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<GoogleStatus>): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      onStatus(await action())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (status?.connected) {
    return (
      <div className="space-y-3">
        <div className="glass-soft flex flex-wrap items-center justify-between gap-4 px-4 py-3 ring-1 ring-positive/30">
          <span className="flex min-w-0 items-center gap-2 text-sm text-positive">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="truncate select-text">Bağlı: {status.email ?? 'Google hesabı'}</span>
          </span>
          <button
            onClick={() => void run(() => window.api.google.disconnect())}
            disabled={busy}
            className={secondaryButtonClass}
          >
            Bağlantıyı kes
          </button>
        </div>
        <p className="text-xs text-faint">
          Asistan bu hesapta e-postaları okuyabilir, taslak hazırlayabilir ve takvime bakabilir.
          E-posta gönderme ve etkinlik ekleme işlemlerinde senden onay ister.
        </p>
        {error && <p className="text-sm text-negative select-text">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Gmail ve Takvim kullanmak için önce Google Cloud&apos;da &quot;Masaüstü uygulaması&quot;
        türünde bir OAuth istemcisi oluştur, sonra bilgilerini buraya gir.
      </p>
      {settings.unreadableSecrets.includes('google-refresh-token') && (
        <p className="glass-soft px-4 py-3 text-sm text-caution ring-1 ring-caution/30">
          Daha önce bağlanan Google hesabının anahtarı bu bilgisayarda çözülemiyor. Bilgileri
          kontrol edip hesabı yeniden bağla.
        </p>
      )}
      <a
        href="https://console.cloud.google.com/apis/credentials"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
      >
        Google Cloud kimlik bilgileri sayfası
        <ExternalLink className="h-3 w-3" />
      </a>

      <SecretField
        id="google-client-id"
        label="İstemci kimliği (Client ID)"
        saved={settings.hasSecret['google-client-id']}
        unreadable={settings.unreadableSecrets.includes('google-client-id')}
        description="Google Cloud'da oluşturduğun OAuth istemcisinin kimliği."
        placeholder="Örn. 1234567890-abc123.apps.googleusercontent.com"
        onSaved={onSettings}
      />
      <SecretField
        id="google-client-secret"
        label="İstemci gizli anahtarı (Client secret)"
        saved={settings.hasSecret['google-client-secret']}
        unreadable={settings.unreadableSecrets.includes('google-client-secret')}
        description="Aynı ekranda verilen gizli anahtar."
        placeholder="Örn. GOCSPX-..."
        onSaved={onSettings}
      />

      <button
        onClick={() => void run(() => window.api.google.connect())}
        disabled={busy || !status?.hasClient}
        className={primaryButtonClass}
      >
        {busy ? 'Tarayıcıda giriş bekleniyor...' : 'Google hesabını bağla'}
      </button>
      {!status?.hasClient && (
        <p className="text-xs text-faint">
          Bağlanmak için önce istemci kimliği ve gizli anahtarı kaydedilmeli.
        </p>
      )}
      {error && <p className="text-sm text-negative select-text">{error}</p>}
    </div>
  )
}

export default GoogleSettings
