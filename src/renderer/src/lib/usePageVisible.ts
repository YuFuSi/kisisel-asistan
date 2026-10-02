import { useSyncExternalStore } from 'react'

function subscribe(listener: () => void): () => void {
  document.addEventListener('visibilitychange', listener)
  return () => document.removeEventListener('visibilitychange', listener)
}

// Pencere gizliyken (ör. tam ekran programda çentik) sürekli animasyonlar durdurulsun diye
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.visibilityState === 'visible',
    () => true
  )
}
