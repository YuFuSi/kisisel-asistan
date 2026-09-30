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

const blankChatListeners = new Set<() => void>()

/** Komut paletinden "Yeni sohbet": metin göndermeden boş bir sohbet açar */
export function requestBlankChat(): void {
  blankChatListeners.forEach((listener) => listener())
}

export function onBlankChatRequest(listener: () => void): () => void {
  blankChatListeners.add(listener)
  return () => {
    blankChatListeners.delete(listener)
  }
}

const attachPathListeners = new Set<Listener<string[]>>()

/** Çentiğe bırakılan belgeler (dosya yolu olarak gelir): yeni sohbette mesaja eklenir */
export function requestAttachPaths(paths: string[]): void {
  attachPathListeners.forEach((listener) => listener(paths))
}

export function onAttachPathsRequest(listener: Listener<string[]>): () => void {
  return subscribe(attachPathListeners, listener)
}

const attachListeners = new Set<Listener<File[]>>()

/** Ana Sayfa'ya bırakılan belgeler: yeni sohbette mesaja eklenmek üzere bekletilir */
export function requestAttachFiles(files: File[]): void {
  attachListeners.forEach((listener) => listener(files))
}

export function onAttachFilesRequest(listener: Listener<File[]>): () => void {
  return subscribe(attachListeners, listener)
}

export function requestOpenConversation(conversationId: number): void {
  openListeners.forEach((listener) => listener(conversationId))
}

export function onOpenConversationRequest(listener: Listener<number>): () => void {
  return subscribe(openListeners, listener)
}
