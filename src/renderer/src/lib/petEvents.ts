// Pet karaktere sayfalardan gelen küçük sinyaller (ör. kullanıcı Pıtır'ı övdü)

export type PetSignal = 'praise'

type Listener = (signal: PetSignal) => void
const listeners = new Set<Listener>()

export function sendPetSignal(signal: PetSignal): void {
  listeners.forEach((listener) => listener(signal))
}

export function onPetSignal(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// Övgü ve sevgi sözleri: robot utanır, kızarır, kalp gönderir
const PRAISE =
  /(teşekkür|tesekkur|sağ ?ol|sag ?ol|eyvallah|aferin|harikasın|süpersin|mükemmelsin|eline sağlık|seni seviyorum|canımsın|çok iyisin)/i

export function isPraise(text: string): boolean {
  return PRAISE.test(text)
}
