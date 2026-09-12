import { AsyncLocalStorage } from 'node:async_hooks'
import type { WebContents } from 'electron'

// Bir araç çalışırken hangi sohbete ait olduğunu ve arayüze nasıl mesaj göndereceğini bilmesi gerekir.
// AsyncLocalStorage, aynı anda birden fazla sohbet cevap yazsa bile her araca kendi bağlamını verir.
export interface ToolContext {
  conversationId: number
  sender: WebContents
}

const storage = new AsyncLocalStorage<ToolContext>()

export function runWithToolContext<T>(context: ToolContext, fn: () => T): T {
  return storage.run(context, fn)
}

/** Araç içinden çağrılır. Bağlam yoksa (ör. testte) undefined döner. */
export function getToolContext(): ToolContext | undefined {
  return storage.getStore()
}
