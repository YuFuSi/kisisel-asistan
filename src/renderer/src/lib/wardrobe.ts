import { useSyncExternalStore } from 'react'

// Robotun kıyafet dolabı (#125): aksesuarlar, nasıl kazanıldıkları ve takılı olanlar.
// Fikirler ChatGPT'den (kullanıcı getirdi). Sade: dolapta sadece Açık / Kilitli / Gizli (???).
// Her şey bu bilgisayarda localStorage'da tutulur; ana pencere ve masaüstü arkadaş paylaşır.

export type AccessorySlot = 'head' | 'antenna' | 'eyes' | 'body' | 'hand'

export const SLOT_LABELS: Record<AccessorySlot, string> = {
  head: 'Baş',
  antenna: 'Anten',
  eyes: 'Göz',
  body: 'Gövde',
  hand: 'El'
}

export type AccessoryId =
  | 'halo'
  | 'headphones'
  | 'bowtie'
  | 'bracelet'
  | 'focusGlasses'
  | 'beanie'
  | 'tie'
  | 'starClip'
  | 'roundGlasses'
  | 'winterHat'
  | 'heartTip'
  | 'partyHat'
  | 'moonBadge'
  | 'coffee'
  | 'crown'
  | 'monocle'

/** Kazanma için gereken istatistikler */
export interface WardrobeStats {
  /** Üst üste kullanılan gün sayısı */
  streak: number
  /** Gece yarısından sonra açıldığı farklı gün sayısı */
  nights: number
  /** Sabah 07-09 arası açıldığı farklı gün sayısı */
  mornings: number
  /** Robotla etkileşim sayısı (okşama, övgü, biten işler...) */
  interactions: number
  /** İlk tanışma zamanı (yıl dönümü için) */
  firstSeen: number
}

interface Accessory {
  id: AccessoryId
  name: string
  slot: AccessorySlot
  /** Nasıl kazanılır (dolapta gösterilir; gizliyse kazanılana kadar ???) */
  how: string
  hidden?: boolean
  unlocked: (stats: WardrobeStats, now: Date) => boolean
}

const always = (): boolean => true
const month = (now: Date): number => now.getMonth() + 1

export const ACCESSORIES: Accessory[] = [
  { id: 'halo', name: 'Lila Halo', slot: 'antenna', how: 'Baştan açık', unlocked: always },
  { id: 'headphones', name: 'Mini Kulaklık', slot: 'head', how: 'Baştan açık', unlocked: always },
  { id: 'bowtie', name: 'Cam Papyon', slot: 'body', how: 'Baştan açık', unlocked: always },
  { id: 'bracelet', name: 'Işık Bilekliği', slot: 'hand', how: 'Baştan açık', unlocked: always },
  {
    id: 'focusGlasses',
    name: 'Odak Gözlüğü',
    slot: 'eyes',
    how: '3 gün üst üste kullan',
    unlocked: (s) => s.streak >= 3
  },
  {
    id: 'beanie',
    name: 'Mini Bere',
    slot: 'head',
    how: '7 gün üst üste kullan',
    unlocked: (s) => s.streak >= 7
  },
  {
    id: 'tie',
    name: 'Cam Kravat',
    slot: 'body',
    how: '10 gün üst üste kullan',
    unlocked: (s) => s.streak >= 10
  },
  {
    id: 'starClip',
    name: 'Yıldız Tokası',
    slot: 'antenna',
    how: '14 gün üst üste kullan',
    unlocked: (s) => s.streak >= 14
  },
  {
    id: 'roundGlasses',
    name: 'Yuvarlak Gözlük',
    slot: 'eyes',
    how: '21 gün üst üste kullan',
    unlocked: (s) => s.streak >= 21
  },
  {
    id: 'winterHat',
    name: 'Kış Beresi',
    slot: 'head',
    how: 'Yılbaşı döneminde (15 Aralık - 15 Ocak)',
    unlocked: (_s, now) =>
      (month(now) === 12 && now.getDate() >= 15) || (month(now) === 1 && now.getDate() <= 15)
  },
  {
    id: 'heartTip',
    name: 'Kalp Anten Ucu',
    slot: 'antenna',
    how: '14 Şubat haftası',
    unlocked: (_s, now) => month(now) === 2 && now.getDate() >= 10 && now.getDate() <= 17
  },
  {
    id: 'partyHat',
    name: 'Parti Şapkası',
    slot: 'head',
    how: 'Tanışmanızın yıl dönümü',
    unlocked: (s, now) => now.getTime() - s.firstSeen >= 365 * 86_400_000
  },
  {
    id: 'moonBadge',
    name: 'Ay Rozeti',
    slot: 'body',
    how: 'Gece yarısından sonra 10 farklı gün kullan',
    hidden: true,
    unlocked: (s) => s.nights >= 10
  },
  {
    id: 'coffee',
    name: 'Kahve Kupası',
    slot: 'hand',
    how: 'Sabah 07-09 arası 10 farklı gün aç',
    hidden: true,
    unlocked: (s) => s.mornings >= 10
  },
  {
    id: 'crown',
    name: 'Minik Taç',
    slot: 'head',
    how: 'Robotla 300 etkileşim',
    hidden: true,
    unlocked: (s) => s.interactions >= 300
  },
  {
    id: 'monocle',
    name: 'Usta Monokl',
    slot: 'eyes',
    how: 'Robotla 600 etkileşim',
    hidden: true,
    unlocked: (s) => s.interactions >= 600
  }
]

export function accessory(id: AccessoryId): Accessory | undefined {
  return ACCESSORIES.find((item) => item.id === id)
}

/** Şu anki istatistiklerle açık olan aksesuarlar (önceden kazanılanlar da açık kalır) */
export function evaluateUnlocks(
  stats: WardrobeStats,
  now: Date,
  earlier: AccessoryId[] = []
): AccessoryId[] {
  const open = new Set<AccessoryId>(earlier)
  for (const item of ACCESSORIES) if (item.unlocked(stats, now)) open.add(item.id)
  return ACCESSORIES.filter((item) => open.has(item.id)).map((item) => item.id)
}

const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export interface DayCounters {
  streak: number
  lastDay: string
  nights: number
  lastNight: string
  mornings: number
  lastMorning: string
}

/** Uygulama açılışında sayaçları günceller: aynı gün tekrar açmak sayıyı artırmaz */
export function countOpening(counters: DayCounters, now: Date): DayCounters {
  const today = dayKey(now)
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const next = { ...counters }
  if (counters.lastDay !== today) {
    next.streak = counters.lastDay === yesterday ? counters.streak + 1 : 1
    next.lastDay = today
  }
  const hour = now.getHours()
  if (hour < 5 && counters.lastNight !== today) {
    next.nights = counters.nights + 1
    next.lastNight = today
  }
  if (hour >= 7 && hour < 9 && counters.lastMorning !== today) {
    next.mornings = counters.mornings + 1
    next.lastMorning = today
  }
  return next
}

// ---- Kayıt ----

export interface WardrobeState {
  counters: DayCounters
  unlocked: AccessoryId[]
  /** Dolapta görülmüş olanlar (yeni kazanılanlar "Yeni" rozetiyle gösterilir) */
  seen: AccessoryId[]
  equipped: Partial<Record<AccessorySlot, AccessoryId>>
}

const KEY = 'jarvis-pet-wardrobe'

function fresh(): WardrobeState {
  return {
    counters: { streak: 0, lastDay: '', nights: 0, lastNight: '', mornings: 0, lastMorning: '' },
    unlocked: [],
    seen: [],
    equipped: {}
  }
}

function read(): WardrobeState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...fresh(), ...(JSON.parse(raw) as Partial<WardrobeState>) }
  } catch {
    // Depolama yoksa boş dolap
  }
  return fresh()
}

let current: WardrobeState = read()
const listeners = new Set<() => void>()

function save(next: WardrobeState): void {
  current = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Kaydedilemese de bu oturumda çalışır
  }
  listeners.forEach((listener) => listener())
}

/**
 * Açılışta ve etkileşimlerde çağrılır: sayaçları ve kazanılanları günceller.
 * Yeni kazanılan aksesuarları döner (robot haber versin diye).
 */
export function refreshWardrobe(
  bond: { interactions: number; firstSeen: number },
  now = new Date()
): AccessoryId[] {
  const state = read()
  const counters = countOpening(state.counters, now)
  const unlocked = evaluateUnlocks(
    { ...counters, interactions: bond.interactions, firstSeen: bond.firstSeen },
    now,
    state.unlocked
  )
  const fresh = unlocked.filter((id) => !state.unlocked.includes(id))
  if (
    fresh.length > 0 ||
    JSON.stringify(counters) !== JSON.stringify(state.counters) ||
    unlocked.length !== state.unlocked.length
  ) {
    // İlk kurulumda baştan açık olanlar "yeni" sayılmaz
    const firstRun = state.unlocked.length === 0
    save({ ...state, counters, unlocked, seen: firstRun ? unlocked : state.seen })
    return firstRun ? [] : fresh
  }
  return []
}

/** Aksesuarı takar; aynı yerdekini çıkarır. Aynısı takılıysa çıkarır. */
export function toggleAccessory(id: AccessoryId): void {
  const item = accessory(id)
  const state = read()
  if (!item || !state.unlocked.includes(id)) return
  const equipped = { ...state.equipped }
  if (equipped[item.slot] === id) delete equipped[item.slot]
  else equipped[item.slot] = id
  save({ ...state, equipped })
}

export function markWardrobeSeen(): void {
  const state = read()
  if (state.seen.length === state.unlocked.length) return
  save({ ...state, seen: [...state.unlocked] })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== KEY) return
    current = read()
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function useWardrobe(): WardrobeState {
  return useSyncExternalStore(subscribe, () => current)
}
