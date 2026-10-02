// Ayarlar'a özel cam kontroller; diğer sayfaların alan stilleri değişmez.
const fieldBase =
  'min-w-0 max-w-full rounded-xl border border-line bg-white/5 px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50'

export const inputClass = `w-full ${fieldBase}`
export const compactInputClass = `shrink-0 ${fieldBase}`

export const choiceClass = (selected: boolean): string =>
  `glass-soft min-w-0 p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${
    selected ? 'ring-1 ring-accent/60 text-ink' : 'text-muted hover:ring-1 hover:ring-line-strong'
  }`

export const detailsClass = 'glass-soft min-w-0 p-4'
export const summaryClass =
  'min-h-8 cursor-pointer text-sm text-muted transition-colors hover:text-ink focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent'
