/**
 * requestAnimationFrame üzerinde kare hızı sınırlı çizim döngüsü.
 * Pencere gizliyken çizmez; `fps()` her karede sorulur, böylece hız duruma göre değişebilir.
 * Dönen fonksiyon döngüyü durdurur.
 */
export function startFrameLoop(draw: (now: number) => void, fps: () => number): () => void {
  let frame = 0
  let last = 0
  let stopped = false

  const tick = (now: number): void => {
    if (stopped) return
    frame = requestAnimationFrame(tick)
    if (document.hidden) return
    const interval = 1000 / Math.max(1, fps())
    // Tarayıcı karesi biraz erken gelirse bir sonrakine atlamamak için 1 ms pay
    if (now - last < interval - 1) return
    last = now
    draw(now)
  }

  frame = requestAnimationFrame(tick)
  return () => {
    stopped = true
    cancelAnimationFrame(frame)
  }
}

/** Pencere odakta değilken kare hızını en fazla `unfocused` değerine indirir */
export function capUnfocused(fps: number, unfocused: number): number {
  return document.hasFocus() ? fps : Math.min(fps, unfocused)
}
