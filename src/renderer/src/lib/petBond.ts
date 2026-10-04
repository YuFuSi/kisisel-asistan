import { useSyncExternalStore } from 'react'

// Pet ile kullanıcının "bağı": mutluluk puanı ve tanışıklık. Sadece bu bilgisayardaki görünüm
// tercihi gibi localStorage'da tutulur (ana pencere ve çentik aynı kaynağı paylaşır).
// - Mutluluk (0-100): okşama, övgü, biten işler artırır; uzakta geçen her saat 1 düşer (bir seferde en
//   fazla 25, 20'nin altına inmez).
// - Tanışıklık: ilk tanışmadan beri geçen gün ve etkileşim sayısıyla utangaç → arkadaş → kanka.

export interface Bond {
  happiness: number
  firstSeen: number
  lastSeen: number
  interactions: number
}

export type BondStage = 'shy' | 'friend' | 'buddy'

export const BOND_STAGE_LABELS: Record<BondStage, string> = {
  shy: 'Yeni tanışıyorsunuz (utangaç)',
  friend: 'Arkadaşsınız',
  buddy: 'Kankasınız'
}

const KEY = 'jarvis-pet-bond'
const DECAY_PER_HOUR = 1
// Bir ayrılıkta en fazla bu kadar düşer ve bu tabanın altına inmez (bir gece uzak kalmak robotu üzmesin)
const MAX_DECAY = 25
const FLOOR = 20

function fresh(): Bond {
  const now = Date.now()
  return { happiness: 70, firstSeen: now, lastSeen: now, interactions: 0 }
}

function read(): Bond {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const value = JSON.parse(raw) as Partial<Bond>
      if (typeof value.happiness === 'number' && typeof value.firstSeen === 'number') {
        return {
          happiness: value.happiness,
          firstSeen: value.firstSeen,
          lastSeen: typeof value.lastSeen === 'number' ? value.lastSeen : Date.now(),
          interactions: typeof value.interactions === 'number' ? value.interactions : 0
        }
      }
    }
  } catch {
    // Depolama yoksa ya da bozuksa yeni tanışma
  }
  return fresh()
}

let current: Bond = read()
const listeners = new Set<() => void>()

function save(next: Bond): void {
  current = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Kaydedilemese de bu oturumda çalışır
  }
  listeners.forEach((listener) => listener())
}

/**
 * Pet açılınca bir kez çağrılır: uzakta geçen süreye göre mutluluk düşer.
 * Kaç saat uzak kalındığını döner (uzun süre sonra gelince pet surat asar).
 */
let openedAway: number | null = null
export function openBond(): number {
  // Pencere başına bir kez hesaplanır (geliştirme modunda bileşen iki kez kurulsa da)
  if (openedAway !== null) return openedAway
  const bond = read()
  const now = Date.now()
  const awayHours = Math.max(0, (now - bond.lastSeen) / 3_600_000)
  save({
    ...bond,
    happiness: Math.max(
      Math.min(bond.happiness, FLOOR),
      bond.happiness - Math.min(MAX_DECAY, awayHours * DECAY_PER_HOUR)
    ),
    lastSeen: now
  })
  openedAway = awayHours
  return awayHours
}

/** Etkileşim: mutluluğu değiştirir (eksi de olabilir) ve tanışıklığı artırır */
export function bumpBond(amount: number): void {
  // Diğer pencere (çentik) arada yazmış olabilir: eski kopyanın üstüne yazılmasın
  const bond = read()
  save({
    ...bond,
    happiness: Math.min(100, Math.max(0, bond.happiness + amount)),
    interactions: bond.interactions + 1,
    lastSeen: Date.now()
  })
}

export function bondStage(bond: Bond): BondStage {
  const days = (Date.now() - bond.firstSeen) / 86_400_000
  if (bond.interactions >= 300 || days >= 30) return 'buddy'
  if (bond.interactions >= 40 || days >= 7) return 'friend'
  return 'shy'
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  // Abone değilken diğer pencerenin yazdıkları kaçmış olabilir
  const latest = read()
  if (JSON.stringify(latest) !== JSON.stringify(current)) {
    current = latest
    queueMicrotask(listener)
  }
  // Diğer pencere (çentik) değiştirirse burası da güncellensin
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

export function useBond(): Bond {
  return useSyncExternalStore(subscribe, () => current)
}
