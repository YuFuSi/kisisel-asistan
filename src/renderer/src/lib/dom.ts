export const COMPOSER_INPUT_ID = 'composer-input'
export const CONVERSATION_SEARCH_ID = 'conversation-search'

// Sohbet yazı kutusuna odaklan (sayfa değişiminin ekrana yansımasını bekleyerek)
export function focusComposer(): void {
  requestAnimationFrame(() => document.getElementById(COMPOSER_INPUT_ID)?.focus())
}

// Sohbet arama kutusuna odaklan ve içindeki metni seç (Ctrl+F)
export function focusConversationSearch(): void {
  window.dispatchEvent(new Event('jarvis:open-history'))
  requestAnimationFrame(() => {
    const input = document.getElementById(CONVERSATION_SEARCH_ID)
    if (input instanceof HTMLInputElement) {
      input.focus()
      input.select()
    }
  })
}
