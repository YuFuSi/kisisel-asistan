// Birden çok bileşende kullanılan Tailwind sınıfları
const fieldBase =
  'rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-600 disabled:opacity-50'

// Satırı dolduran giriş kutusu
export const inputClass = `w-full ${fieldBase}`

// Genişliği ayrıca verilen (tarih seçici gibi) giriş kutusu
export const compactInputClass = `shrink-0 ${fieldBase}`

export const primaryButtonClass =
  'shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40'

export const secondaryButtonClass =
  'shrink-0 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40'

export const sectionTitleClass = 'text-xs font-semibold tracking-wider text-zinc-500 uppercase'

export const tabClass = (active: boolean): string =>
  `-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
    active ? 'border-violet-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
  }`

export const iconButtonClass =
  'rounded p-1.5 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100'
