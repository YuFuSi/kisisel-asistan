import { useEffect, useRef, useState } from 'react'
import type { HandPoint } from './useHandTracking'

// Tur O: elle gerçek bir OS penceresini kavrayıp sürükleme. Pinch başladığında o an öndeki
// (odaklanmış) pencere "kavranır"; pinch basılıyken el hareket ettikçe pencere elin ekrandaki
// mutlak konumunu takip eder; pinch bırakılınca bırakılır.
//
// Taşıma çağrıları artık kalıcı bir PowerShell sürecinden geçiyor (windowDaemon.ts) — Add-Type
// sadece bir kez derlendiği için her komut birkaç milisaniye sürüyor. Yine de elin her karesinde
// (30-60/sn) IPC + PowerShell round-trip yapmak gereksiz; hafif bir sınırlama akıcılığı bozmadan
// gereksiz trafiği azaltıyor.
const MOVE_THROTTLE_MS = 40

export function useWindowDrag(
  enabled: boolean,
  pinching: boolean,
  handNormalized: HandPoint | null
): { dragging: boolean } {
  const draggingId = useRef<number | null>(null)
  const lastMoveAt = useRef(0)
  const moveInFlight = useRef(false)
  const [dragging, setDragging] = useState(false)

  // Pinch'in başladığı an: o anki ön plandaki pencereyi "kavra"
  useEffect(() => {
    if (!enabled) {
      draggingId.current = null
      void Promise.resolve().then(() => setDragging(false))
      return
    }
    if (pinching && draggingId.current === null) {
      void window.api.windows.foreground().then((id) => {
        draggingId.current = id
        if (id !== null) setDragging(true)
      })
    } else if (!pinching && draggingId.current !== null) {
      draggingId.current = null
      setDragging(false)
    }
  }, [enabled, pinching])

  // Pinch basılıyken el hareket ettikçe (sınırlı sıklıkla) pencereyi elin altına taşı
  useEffect(() => {
    if (!enabled || !pinching || draggingId.current === null || !handNormalized) return
    if (moveInFlight.current) return
    const now = performance.now()
    if (now - lastMoveAt.current < MOVE_THROTTLE_MS) return
    lastMoveAt.current = now
    // Pencerenin sol üst köşesi elin altında ortalanır (yaklaşık, gerçek pencere boyutu bilinmiyor)
    const x = Math.round(handNormalized.x * window.screen.width - 200)
    const y = Math.round(handNormalized.y * window.screen.height - 100)
    moveInFlight.current = true
    void window.api.windows
      .move(draggingId.current, x, y)
      .catch(() => {})
      .finally(() => {
        moveInFlight.current = false
      })
  }, [enabled, pinching, handNormalized])

  return { dragging }
}
