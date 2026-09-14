// Başka bir sayfadan (ör. Ana Sayfa'daki komut kutusu) sohbet sayfasına "bunu yeni sohbette sor" isteği.
// Sohbet sayfası hep açık kaldığı için isteği her zaman dinler.

type Listener = (text: string) => void

const listeners = new Set<Listener>()

export function requestNewChat(text: string): void {
  listeners.forEach((listener) => listener(text))
}

export function onNewChatRequest(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
