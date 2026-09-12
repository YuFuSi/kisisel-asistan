import type { ModelMessage } from 'ai'
import { toModelContent } from '../../shared/attachments'
import type { ChatMessage } from '../../shared/api'

/** Araç sonuçları sadece bu kadar son asistan mesajı için modele verilir (bağlam dolmasın) */
export const TOOL_HISTORY_MESSAGES = 6
/** Saklanan araç sonucunun en fazla uzunluğu */
export const TOOL_RESULT_LIMIT = 1500

/** Araç sonucunu saklanabilir, kısa bir metne çevirir */
export function summarizeToolOutput(output: unknown): string {
  let text: string
  try {
    text = typeof output === 'string' ? output : (JSON.stringify(output) ?? '')
  } catch {
    text = String(output)
  }
  return text.length > TOOL_RESULT_LIMIT ? `${text.slice(0, TOOL_RESULT_LIMIT)}…(kısaltıldı)` : text
}

type AssistantParts = Extract<ModelMessage, { role: 'assistant' }>['content']
type ToolParts = Extract<ModelMessage, { role: 'tool' }>['content']

/**
 * Kayıtlı mesajları modele gidecek geçmişe çevirir. Son asistan cevaplarında kullanılan araçların
 * girdisi ve sonucu da eklenir; böylece model "az önce eklediğim görev" gibi şeyleri bilir.
 * Adımların gerçek sırası saklanmadığı için düzen: araç çağrıları → sonuçlar → cevap metni.
 */
export function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  const recent = new Set(
    messages
      .filter((m) => m.role === 'assistant')
      .slice(-TOOL_HISTORY_MESSAGES)
      .map((m) => m.id)
  )
  const result: ModelMessage[] = []

  for (const message of messages) {
    if (message.role === 'user') {
      if (message.content.trim()) {
        result.push({ role: 'user', content: toModelContent(message.content) })
      }
      continue
    }

    // Eski kayıtlarda sonuç yok; onlar sadece metin olarak gider
    const tools = recent.has(message.id)
      ? message.tools.filter((t) => t.result !== undefined && t.status !== 'running')
      : []
    if (tools.length > 0) {
      const calls: AssistantParts = tools.map((t) => ({
        type: 'tool-call' as const,
        toolCallId: t.id,
        toolName: t.name,
        input: t.input ?? {}
      }))
      const results: ToolParts = tools.map((t) => ({
        type: 'tool-result' as const,
        toolCallId: t.id,
        toolName: t.name,
        output:
          t.status === 'error'
            ? { type: 'error-text' as const, value: t.result ?? '' }
            : { type: 'text' as const, value: t.result ?? '' }
      }))
      result.push({ role: 'assistant', content: calls })
      result.push({ role: 'tool', content: results })
    }
    if (message.content.trim()) result.push({ role: 'assistant', content: message.content })
  }
  return result
}
