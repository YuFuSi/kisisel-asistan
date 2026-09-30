import { useSyncExternalStore } from 'react'

let query: MediaQueryList | undefined

function mediaQuery(): MediaQueryList {
  return (query ??= window.matchMedia('(prefers-reduced-motion: reduce)'))
}

function subscribe(listener: () => void): () => void {
  const media = mediaQuery()
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

// Tercih uygulama açıkken değişirse CSS dışındaki hareketler de aynı anda güncellenir.
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => mediaQuery().matches,
    () => true
  )
}
