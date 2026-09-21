import type { AssistantState } from './assistantState'

// Küre tek vurgu renginin (accent, ~231°) çevresinde kalır; durum sadece tonu hafifçe kaydırır
const BASE_HUE = 231

export const STATE_HUE_SHIFT: Record<AssistantState, number> = {
  idle: 0,
  listening: -12,
  thinking: 18,
  working: 32,
  speaking: -22
}

/** Belirli bir durumun küre rengi (hsla); lightness ve alpha çizim katmanına göre verilir */
export function orbHsla(
  state: AssistantState,
  lightness: number,
  alpha = 1,
  hueOffset = 0
): string {
  const hue = Math.round((BASE_HUE + STATE_HUE_SHIFT[state] + hueOffset + 360) % 360)
  return `hsla(${hue}, 100%, ${lightness}%, ${alpha})`
}
