import type { AssistantState } from './assistantState'

// Küre tek vurgu renginin (accent, ~231° indigo) çevresinde kalır; her durumun kendi belirgin tonu var
const BASE_HUE = 231

export const STATE_HUE_SHIFT: Record<AssistantState, number> = {
  idle: 0,
  listening: -34,
  thinking: 26,
  working: 44,
  speaking: -58,
  approval: 0
}

/** Verilen ton kaymasıyla küre rengi (hsla); geçiş animasyonlarında ara değerler için kullanılır */
export function orbHslaShift(shift: number, lightness: number, alpha = 1, hueOffset = 0): string {
  const hue = Math.round((BASE_HUE + shift + hueOffset + 360) % 360)
  return `hsla(${hue}, 72%, ${lightness}%, ${alpha})`
}

/** orbHslaShift ile aynı renk, WebGL için 0-1 aralığında RGB olarak */
export function orbRgb(shift: number, lightness: number, hueOffset = 0): [number, number, number] {
  const hue = (((BASE_HUE + shift + hueOffset) % 360) + 360) % 360
  const s = 0.72
  const l = lightness / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x]
  return [r + m, g + m, b + m]
}

/** Belirli bir durumun küre rengi (hsla); lightness ve alpha çizim katmanına göre verilir */
export function orbHsla(
  state: AssistantState,
  lightness: number,
  alpha = 1,
  hueOffset = 0
): string {
  return orbHslaShift(STATE_HUE_SHIFT[state], lightness, alpha, hueOffset)
}
