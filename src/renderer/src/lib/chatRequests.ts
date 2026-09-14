// Başka bir sayfadan (ör. Ana Sayfa) sohbet sayfasına istekler: "bunu yeni sohbette sor" ve
// "şu sohbeti aç". Sohbet sayfası hep açık kaldığı için istekleri her zaman dinler.

type Listener<T> = (value: T) => void

const newChatListeners = new Set<Listener<string>>()
const openListeners = new Set<Listener<number>>()

function subscribe<T>(listeners: Set<Listener<T>>, listener: Listener<T>): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function requestNewChat(text: string): void {
  newChatListeners.forEach((listener) => listener(text))
}

export function onNewChatRequest(listener: Listener<string>): () => void {
  return subscribe(newChatListeners, listener)
}

export function requestOpenConversation(conversationId: number): void {
  openListeners.forEach((listener) => listener(conversationId))
}

export function onOpenConversationRequest(listener: Listener<number>): () => void {
  return subscribe(openListeners, listener)
}
