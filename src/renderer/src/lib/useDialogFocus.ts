import { useEffect, type RefObject } from 'react'

const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
const panels: HTMLElement[] = []

function focusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) =>
      !element.matches(':disabled') &&
      element.tabIndex >= 0 &&
      !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
      element.getClientRects().length > 0
  )
}

// Her pencere kendi odağını saklar; iç içe pencereler kapanırken önce bir önceki katmana döner.
export function useDialogFocus(open: boolean, panelRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const currentPanel = panelRef.current
    if (!open || !currentPanel) return
    const panel: HTMLElement = currentPanel
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panels.push(panel)
    const frame = requestAnimationFrame(() => {
      if (panels.at(-1) !== panel) return
      const initial = panel.querySelector<HTMLElement>('[data-initial-focus]')
      ;(initial ?? focusableElements(panel)[0] ?? panel).focus()
    })
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Tab' || event.defaultPrevented || panels.at(-1) !== panel) return
      // Üstte yeni bir diyalog açıldıysa alttaki odak tuzağı araya girmesin.
      const target = event.target as HTMLElement | null
      if (target?.closest('[aria-modal="true"]') !== panel) return
      const elements = focusableElements(panel)
      const index = elements.indexOf(document.activeElement as HTMLElement)
      if (elements.length === 0) {
        event.preventDefault()
        panel.focus()
      } else if (event.shiftKey && index <= 0) {
        event.preventDefault()
        elements.at(-1)?.focus()
      } else if (!event.shiftKey && (index === -1 || index === elements.length - 1)) {
        event.preventDefault()
        elements[0].focus()
      }
    }
    function onFocus(event: FocusEvent): void {
      if (panels.at(-1) !== panel || panel.contains(event.target as Node)) return
      ;(focusableElements(panel)[0] ?? panel).focus()
    }
    panel.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocus)
    return () => {
      cancelAnimationFrame(frame)
      panel.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocus)
      const wasTop = panels.at(-1) === panel
      panels.splice(panels.indexOf(panel), 1)
      if (wasTop && previous?.isConnected) previous.focus()
    }
  }, [open, panelRef])
}
