import { isStepCount, streamText } from 'ai'
import { getAssistantTools } from '../tools'
import { AutomationApprovalSkipped } from '../tools/approval'
import { runWithToolContext } from '../tools/context'
import { buildInstructions } from './chat'
import { getModel, getModelOptions } from './providers'
import type { RoutineAllowance } from '../../shared/api'

// Kullanıcının başında beklemediği bir çalıştırma; sonsuz araç döngüsüne izin verilmez
const AUTOMATION_MAX_STEPS = 8

export interface AutomationTurnResult {
  /** Modelin çalıştırma sonunda ürettiği özet metin */
  text: string
  /** İzin yetersizliği nedeniyle atlanan araç çağrıları */
  skipped: { tool: string; label: string }[]
}

/**
 * Bir otomasyonun talimatını asistana normal bir istek gibi verir; hiçbir sohbete/mesaja
 * kaydetmez, canlı bir pencere/WebContents'a ihtiyaç duymaz. `ai/chat.ts`'teki `sendMessage`'ın
 * aksine görünür sohbet listesini kirletmez ve `sender` gerektirmez (bkz. plan dosyasındaki
 * "gizli sohbet" yerine ayrı, hafif fonksiyon" kararı).
 */
export async function runAutomationTurn(
  prompt: string,
  allowance: RoutineAllowance,
  conversationId: number
): Promise<AutomationTurnResult> {
  const skipped: { tool: string; label: string }[] = []
  let text = ''
  let needsSeparator = false

  await runWithToolContext({ conversationId, source: 'automation', allowance }, async () => {
    const instructions = await buildInstructions(prompt, '', 'automation')
    const result = streamText({
      model: getModel(),
      instructions,
      messages: [{ role: 'user', content: prompt }],
      tools: getAssistantTools(),
      stopWhen: isStepCount(AUTOMATION_MAX_STEPS),
      ...getModelOptions()
    })

    for await (const part of result.stream) {
      switch (part.type) {
        case 'text-delta': {
          const chunk = needsSeparator && text ? `\n\n${part.text}` : part.text
          needsSeparator = false
          text += chunk
          break
        }
        case 'finish-step':
          needsSeparator = true
          break
        case 'tool-error': {
          const reason = part.error instanceof Error ? part.error.message : String(part.error)
          if (part.error instanceof AutomationApprovalSkipped) {
            skipped.push({ tool: part.toolName, label: part.error.toolLabel })
          }
          console.warn(`Rutin araç hatası (${part.toolName}):`, reason)
          break
        }
        case 'error':
          throw part.error
      }
    }
  })

  return { text: text.trim(), skipped }
}
