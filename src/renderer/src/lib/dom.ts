export const COMPOSER_INPUT_ID = 'composer-input'

// Sohbet yazı kutusuna odaklan (sayfa değişiminin ekrana yansımasını bekleyerek)
export function focusComposer(): void {
  requestAnimationFrame(() => document.getElementById(COMPOSER_INPUT_ID)?.focus())
}
