import type { AssistantState } from './assistantState'

// Taban renk döngüsü: mavi -> mor -> magenta -> pembe -> altın -> başa dön
const HUE_STOPS = [205, 255, 300, 335, 45, 205]

/** t: 0-1 arası (döngüsel) zaman değeri; 0-360 arası hue derecesi döner */
export function baseHue(t: number): number {
  const wrapped = ((t % 1) + 1) % 1
  const scaled = wrapped * (HUE_STOPS.length - 1)
  const index = Math.floor(scaled)
  const fraction = scaled - index
  return HUE_STOPS[index] + (HUE_STOPS[index + 1] - HUE_STOPS[index]) * fraction
}

// Her durumun taban döngüye eklediği sıcaklık kayması (derece)
export const STATE_HUE_BIAS: Record<AssistantState, number> = {
  idle: 0,
  listening: 10,
  thinking: -35,
  working: -35,
  speaking: 20
}

/** Belirli bir zaman ve duruma göre küre parçacığının rengi */
export function orbHsl(
  t: number,
  state: AssistantState,
  saturation: number,
  lightness: number
): string {
  const hue = Math.round((baseHue(t) + STATE_HUE_BIAS[state] + 360) % 360)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}
