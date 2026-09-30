import { useEffect, useEffectEvent } from 'react'
import { createDismissStack } from './dismissStack'

const stack = createDismissStack()
let count = 0

function onEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.isComposing || count === 0) return
  if (!event.repeat && !stack.dismissTop()) return
  event.preventDefault()
  event.stopImmediatePropagation()
}

// Capture aşaması, eski ses katmanı dinleyicisinin de aynı Escape'i işlemesini engeller.
export function useDismissLayer(open: boolean, priority: number, onClose: () => void): void {
  const dismiss = useEffectEvent(onClose)
  useEffect(() => {
    if (!open) return
    const remove = stack.add(priority, () => dismiss())
    if (count++ === 0) document.addEventListener('keydown', onEscape, true)
    return () => {
      remove()
      if (--count === 0) document.removeEventListener('keydown', onEscape, true)
    }
  }, [open, priority])
}
