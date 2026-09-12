// Birden çok bileşende kullanılan Tailwind sınıfları.
// Renkler main.css içindeki tasarım belirteçlerinden gelir (surface, line, ink, accent...).

const fieldBase =
  'rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent/70 disabled:opacity-50'

/** Satırı dolduran giriş kutusu */
export const inputClass = `w-full ${fieldBase}`

/** Genişliği ayrıca verilen (tarih seçici gibi) giriş kutusu */
export const compactInputClass = `shrink-0 ${fieldBase}`

export const primaryButtonClass =
  'shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40'

export const secondaryButtonClass =
  'shrink-0 rounded-lg border border-line bg-elevated px-4 py-2 text-sm text-ink transition-colors hover:border-line-strong hover:bg-line/40 disabled:cursor-not-allowed disabled:opacity-40'

export const sectionTitleClass = 'text-xs font-semibold tracking-wider text-faint uppercase'

export const cardClass = 'rounded-card border border-line bg-surface'

export const tabClass = (active: boolean): string =>
  `-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
    active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
  }`

/** Satır üzerinde fareyle görünen küçük simge düğmesi */
export const iconButtonClass =
  'rounded-md p-1.5 text-faint opacity-0 transition group-hover:opacity-100 hover:bg-line/60 hover:text-ink focus:opacity-100'

/** Her zaman görünen küçük simge düğmesi */
export const quietIconButtonClass =
  'rounded-md p-1.5 text-faint transition-colors hover:bg-line/60 hover:text-ink'
