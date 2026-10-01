import Orb from '../jarvis/Orb'
import {
  CHARACTERS,
  ORB_INTENSITIES,
  ORB_THEMES,
  setOrbPrefs,
  useOrbPrefs
} from '../../lib/orbPrefs'
import { playSfx, setSfxEnabled, useSfxEnabled } from '../../lib/soundEffects'
import { BOND_STAGE_LABELS, bondStage, useBond } from '../../lib/petBond'
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
  const bond = useBond()
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
          label="Karakter"
          hint="Ana Sayfa'da Jarvis'i temsil eden karakter. Pet karakterler imleci takip eder, sevinir, üzülür, boşta kalınca uyur."
        >
          <div className="flex flex-wrap gap-2">
            {CHARACTERS.map((character) => (
              <button
                key={character.id}
                onClick={() => setOrbPrefs({ character: character.id })}
                className={chip(prefs.character === character.id)}
              >
                {character.label}
              </button>
            ))}
          </div>
        </Field>
        {prefs.character !== 'orb' && (
          <Field
            label="Aranız"
            hint="Okşadıkça, övdükçe ve birlikte iş bitirdikçe Jarvis mutlu olur; uzun süre ilgilenmezsen surat asar. Zamanla utangaçlıktan kankalığa geçer."
          >
            <div className="flex items-center gap-3">
              <div className="h-2 w-40 overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#ff9ec7] to-[#8b9bff]"
                  style={{ width: `${Math.round(bond.happiness)}%` }}
                />
              </div>
              <span className="text-sm text-muted">
                Mutluluk {Math.round(bond.happiness)} · {BOND_STAGE_LABELS[bondStage(bond)]}
              </span>
            </div>
          </Field>
        )}
        <Field
          label="Kürenin yüzü"
          hint="Işıktan gözler Jarvis'in ne yaptığını gösterir: dinlerken büyür, düşünürken yana bakar, iş bitince gülümser."
        >
          <div className="flex items-center gap-2">
            <button onClick={() => setOrbPrefs({ face: true })} className={chip(prefs.face)}>
              Göster
            </button>
            <button onClick={() => setOrbPrefs({ face: false })} className={chip(!prefs.face)}>
              Gizle
            </button>
            <span className="ml-2" title="Küçük hâli: başlık çubuğu ve çentik">
              <Orb state="idle" size={56} />
            </span>
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
