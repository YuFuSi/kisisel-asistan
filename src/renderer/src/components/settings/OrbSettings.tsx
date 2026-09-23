import Orb from '../jarvis/Orb'
import { ORB_INTENSITIES, ORB_THEMES, setOrbPrefs, useOrbPrefs } from '../../lib/orbPrefs'
import { playSfx, setSfxEnabled, useSfxEnabled } from '../../lib/soundEffects'
import Field from './Field'

const chip = (active: boolean): string =>
  `rounded-[10px] border px-3 py-1.5 text-sm transition-colors ${
    active
      ? 'border-accent bg-accent/15 text-ink'
      : 'border-line text-muted hover:border-line-strong hover:text-ink'
  }`

// Kürenin renk teması ve yoğunluğu; canlı önizleme ile
function OrbSettings(): React.JSX.Element {
  const prefs = useOrbPrefs()
  const sfx = useSfxEnabled()
  return (
    <div className="flex flex-wrap items-center gap-8">
      <div className="shrink-0">
        <Orb state="idle" size={200} />
      </div>
      <div className="min-w-[260px] flex-1 space-y-5">
        <Field label="Küre rengi" hint="Sadece bu bilgisayarda geçerli görünüm tercihidir.">
          <div className="flex flex-wrap gap-2">
            {ORB_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setOrbPrefs({ theme: theme.id })}
                className={`${chip(prefs.theme === theme.id)} flex items-center gap-2`}
              >
                <span
                  className="size-3 rounded-full"
                  style={{ background: theme.swatch }}
                  aria-hidden
                />
                {theme.label}
              </button>
            ))}
          </div>
        </Field>
        <Field
          label="Ses efektleri"
          hint="Cevap bitince, hata olunca, onay beklerken ve bildirimde kısa sesler."
        >
          <div className="flex gap-2">
            <button onClick={() => setSfxEnabled(true)} className={chip(sfx)}>
              Açık
            </button>
            <button onClick={() => setSfxEnabled(false)} className={chip(!sfx)}>
              Kapalı
            </button>
            <button
              onClick={() => playSfx('done')}
              className="rounded-[10px] px-3 py-1.5 text-sm text-muted hover:text-ink"
            >
              Dene
            </button>
          </div>
        </Field>
        <Field label="Yoğunluk" hint="İç ışığın parlaklığı ve akış hızı.">
          <div className="flex flex-wrap gap-2">
            {ORB_INTENSITIES.map((level) => (
              <button
                key={level.id}
                onClick={() => setOrbPrefs({ intensity: level.id })}
                className={chip(prefs.intensity === level.id)}
              >
                {level.label}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </div>
  )
}

export default OrbSettings
