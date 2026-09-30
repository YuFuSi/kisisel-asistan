interface DismissLayer {
  priority: number
  dismiss: () => void
}

// Görsel katman sırası önceliklidir; aynı seviyede son açılan katman kapanır.
export function createDismissStack(): {
  add: (priority: number, dismiss: () => void) => () => void
  dismissTop: () => boolean
} {
  const layers: DismissLayer[] = []
  return {
    add(priority, dismiss) {
      const layer = { priority, dismiss }
      layers.push(layer)
      return (): void => {
        const index = layers.indexOf(layer)
        if (index >= 0) layers.splice(index, 1)
      }
    },
    dismissTop() {
      const top = layers.reduce<DismissLayer | null>(
        (current, layer) => (!current || layer.priority >= current.priority ? layer : current),
        null
      )
      if (!top) return false
      top.dismiss()
      return true
    }
  }
}
