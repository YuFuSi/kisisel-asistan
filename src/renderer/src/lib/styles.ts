import { buttonClass } from '../components/ui/buttonStyles'

// Birden çok bileşende kullanılan Tailwind sınıfları.
// Renkler main.css içindeki tasarım belirteçlerinden gelir (surface, line, ink, accent...).

const fieldBase =
  'rounded-[10px] border border-line bg-app px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent/70 disabled:opacity-50'

/** Satırı dolduran giriş kutusu */
export const inputClass = `w-full ${fieldBase}`

/** Genişliği ayrıca verilen (tarih seçici gibi) giriş kutusu */
export const compactInputClass = `shrink-0 ${fieldBase}`

// Düz <button> için düğme sınıfları; görünüm components/ui/Button ile aynı kaynaktan gelir.
// Küçük düğme için buttonClass('secondary', 'sm') kullanılır (py/text sınıfı eklenip çakıştırılmaz).
export { buttonClass }
export const primaryButtonClass = buttonClass('primary')
export const secondaryButtonClass = buttonClass('secondary')

export const sectionTitleClass = 'text-xs font-medium tracking-wide text-faint'

export const cardClass = 'rounded-card border border-line bg-surface'

export const tabClass = (active: boolean): string =>
  `-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
    active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
  }`

/** Satır üzerinde fareyle görünen küçük simge düğmesi */
export const iconButtonClass =
  'rounded-md p-1.5 text-faint opacity-0 transition group-hover:opacity-100 hover:bg-elevated hover:text-ink focus:opacity-100'

/** Her zaman görünen küçük simge düğmesi */
export const quietIconButtonClass =
  'rounded-md p-1.5 text-faint transition-colors hover:bg-elevated hover:text-ink'
