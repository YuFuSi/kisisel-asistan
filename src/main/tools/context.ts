import { AsyncLocalStorage } from 'node:async_hooks'
import type { WebContents } from 'electron'
import type { RoutineAllowance } from './permissions'
import type { ToolRisk, ToolSource } from '../../shared/api'

// Şu an çalışan araç çağrısı. Araç sarmalayıcısı (tools/index.ts) oluşturur;
// requireApproval onay sonucunu buraya yazar, sarmalayıcı da etkinlik kaydına ekler.
export interface ToolCallState {
  name: string
  risk: ToolRisk
  approval?: 'approved' | 'denied' | 'timeout' | 'auto'
}

// Bir araç çalışırken hangi sohbete ait olduğunu ve arayüze nasıl mesaj göndereceğini bilmesi gerekir.
// AsyncLocalStorage, aynı anda birden fazla sohbet cevap yazsa bile her araca kendi bağlamını verir.
export interface ToolContext {
  conversationId: number
  sender: WebContents
  /** Aracı kim başlattı; onay kuralları buna göre değişir */
  source: ToolSource
  /** Rutinlerde kullanıcının verdiği izin */
  allowance?: RoutineAllowance
  /** İş dışarıdan gelen içerikle tetiklendiyse true */
  external?: boolean
  call?: ToolCallState
}

const storage = new AsyncLocalStorage<ToolContext>()

export function runWithToolContext<T>(context: ToolContext, fn: () => T): T {
  return storage.run(context, fn)
}

/** Araç içinden çağrılır. Bağlam yoksa (ör. testte) undefined döner. */
export function getToolContext(): ToolContext | undefined {
  return storage.getStore()
}
