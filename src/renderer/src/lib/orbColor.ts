import type { AssistantState } from './assistantState'

// Küre tek vurgu renginin (accent, ~231° indigo) çevresinde kalır; her durumun kendi belirgin tonu var
const BASE_HUE = 231

export const STATE_HUE_SHIFT: Record<AssistantState, number> = {
  idle: 0,
  listening: -34,
  thinking: 26,
  working: 44,
  speaking: -58
}

/** Verilen ton kaymasıyla küre rengi (hsla); geçiş animasyonlarında ara değerler için kullanılır */
export function orbHslaShift(shift: number, lightness: number, alpha = 1, hueOffset = 0): string {
  const hue = Math.round((BASE_HUE + shift + hueOffset + 360) % 360)
  return `hsla(${hue}, 72%, ${lightness}%, ${alpha})`
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
