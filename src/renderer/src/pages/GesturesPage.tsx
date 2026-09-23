import Orb from '../components/jarvis/Orb'
import OrbitTools from '../components/jarvis/OrbitTools'
import { useHandTracking } from '../lib/useHandTracking'
import type { PageId } from '../lib/pages'

// Deneme sayfası (Tur O): useHandTracking + OrbitTools'un tek başına doğru çalıştığını
// görmek için izole bir alan. Gerçek özellik artık Ana Sayfa'ya taşındı (HomePage.tsx,
// "El ile kontrol" düğmesi); bu sayfa sadece hata ayıklama için tutuluyor.
const HAND_GAIN_X = 460
const HAND_GAIN_Y = 200

interface GesturesPageProps {
  onNavigate: (page: PageId) => void
}

export default function GesturesPage({ onNavigate }: GesturesPageProps): React.JSX.Element {
  const { videoRef, status, errorMessage, pinching, handPoint } = useHandTracking(
    true,
    HAND_GAIN_X,
    HAND_GAIN_Y
  )

  return (
    <div className="flex h-full items-center justify-center gap-10 p-6">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-lg font-medium text-ink">Kamera el takibi (hata ayıklama)</h1>
        <p className="max-w-xs text-center text-sm text-muted">
          Asıl özellik artık Ana Sayfa&apos;da. Bu sayfa sadece kamera/model sorunlarını izole test
          etmek için tutuluyor.
        </p>
        <div className="relative overflow-hidden rounded-16 border border-line">
          <video ref={videoRef} className="w-[360px] -scale-x-100" muted playsInline />
        </div>
        {status === 'loading' && <p className="text-sm text-muted">Modeller yükleniyor...</p>}
        {status === 'error' && <p className="text-sm text-negative">Hata: {errorMessage}</p>}
        {status === 'ready' && (
          <div
            className={
              'rounded-10 border px-4 py-2 text-sm font-medium transition-colors ' +
              (pinching ? 'border-accent bg-accent/20 text-accent' : 'border-line text-muted')
            }
          >
            {pinching ? 'PINCH ALGILANDI' : 'bekleniyor...'}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 border-l border-line pl-10">
        <h2 className="text-sm font-medium text-ink">Yörünge denemesi</h2>
        <div className="relative flex items-center justify-center">
          <Orb state="idle" size={140} />
          <div className="pointer-events-none absolute">
            <OrbitTools handPoint={handPoint} pinching={pinching} onSelect={onNavigate} />
          </div>
        </div>
      </div>
    </div>
  )
}
