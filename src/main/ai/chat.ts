import { isStepCount, streamText, type ModelMessage } from 'ai'
import type { WebContents } from 'electron'
import { addMessage, listMessages, setTitleIfEmpty } from '../data/conversations'
import { listMemories } from '../data/memories'
import { toLocalIso } from '../lib/datetime'
import { assistantTools, toolLabel } from '../tools'
import { getModel } from './providers'
import { describeError } from './errors'
import type { ChatEvent, ChatMessage, ToolActivity, ToolStatus } from '../../shared/api'

// Modele gönderilecek en fazla geçmiş mesaj sayısı
const HISTORY_LIMIT = 40
// Bir cevapta en fazla kaç adım (araç çağrısı + cevap) yapılabilir
const MAX_STEPS = 6
// Sistem talimatına eklenecek en fazla hafıza kaydı
const MEMORY_LIMIT = 50

// Şu an cevap yazılan sohbetler (durdurabilmek için)
const activeChats = new Map<number, AbortController>()

function buildInstructions(): string {
  const now = new Date()
  const weekday = now.toLocaleDateString('tr-TR', { weekday: 'long' })
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const lines = [
    'Sen kullanıcının bilgisayarında çalışan kişisel asistanısın.',
    'Kullanıcı hangi dilde yazarsa o dilde cevap ver; varsayılan dilin Türkçe.',
    'Net, samimi ve yardımsever ol; gereksiz uzun cevaplardan kaçın. Uygun olduğunda Markdown kullan.',
    'Emin olmadığın bilgileri uydurma, emin değilsen açıkça söyle.',
    '',
    `Şu anki yerel zaman: ${toLocalIso(now)} (${weekday}), saat dilimi: ${timeZone}.`,
    '"Yarın", "haftaya", "2 saat sonra" gibi ifadeleri bu zamana göre hesapla.',
    '',
    'Araçların hakkında:',
    '- Görev, hatırlatma, not ve hafıza işlemlerini gerçekten araç çağırarak yap; araç çağırmadan yapmış gibi davranma.',
    '- "... hatırlat" (belirli bir zamanda bildirim) için hatirlatma_kur kullan.',
    '- "Bunu hatırla / aklında tut" denirse veya kullanıcı kendisi hakkında kalıcı bir bilgi paylaşırsa hafizaya_kaydet kullan.',
    '- Araç kullandıktan sonra ne yaptığını kısaca söyle.'
  ]

  const memories = listMemories().slice(-MEMORY_LIMIT)
  if (memories.length > 0) {
    lines.push(
      '',
      'Kullanıcı hakkında bildiklerin (hafıza):',
      ...memories.map((m) => `- ${m.content}`)
    )
  }
  return lines.join('\n')
}

export function sendMessage(
  sender: WebContents,
  conversationId: number,
  text: string
): ChatMessage {
  const content = text.trim()
  if (!content) throw new Error('Boş mesaj gönderilemez.')
  if (activeChats.has(conversationId)) throw new Error('Bu sohbette zaten bir cevap yazılıyor.')

  // Model ayarı eksikse mesajı kaydetmeden hemen hata ver
  getModel()

  const userMessage = addMessage(conversationId, 'user', content)
  setTitleIfEmpty(conversationId, content)

  const controller = new AbortController()
  activeChats.set(conversationId, controller)
  // Cevap akışı bu IPC çağrısı döndükten sonra başlasın; böylece arayüz önce kullanıcı mesajını alır
  setImmediate(() => void streamReply(sender, conversationId, controller))

  return userMessage
}

export function stopChat(conversationId: number): void {
  activeChats.get(conversationId)?.abort()
}

// Yarıda kalan (hâlâ "çalışıyor" görünen) araçları başarısız say
const settleTools = (tools: ToolActivity[]): ToolActivity[] =>
  tools.map((t) => (t.status === 'running' ? { ...t, status: 'error' } : t))

async function streamReply(
  sender: WebContents,
  conversationId: number,
  controller: AbortController
): Promise<void> {
  const emit = (event: ChatEvent): void => {
    if (!sender.isDestroyed()) sender.send('chat:event', event)
  }
  let answer = ''
  let needsSeparator = false
  const tools: ToolActivity[] = []

  const trackTool = (id: string, name: string, status: ToolStatus): void => {
    const activity: ToolActivity = { id, name, label: toolLabel(name), status }
    const index = tools.findIndex((t) => t.id === id)
    if (index === -1) tools.push(activity)
    else tools[index] = activity
    emit({ conversationId, type: 'tool', activity })
  }

  try {
    const messages = listMessages(conversationId)
      .filter((m) => m.content.trim() !== '')
      .slice(-HISTORY_LIMIT)
      .map((m): ModelMessage =>
        m.role === 'user'
          ? { role: 'user', content: m.content }
          : { role: 'assistant', content: m.content }
      )

    const result = streamText({
      model: getModel(),
      instructions: buildInstructions(),
      messages,
      tools: assistantTools,
      stopWhen: isStepCount(MAX_STEPS),
      abortSignal: controller.signal
    })

    for await (const part of result.stream) {
      switch (part.type) {
        case 'text-delta': {
          // Araç adımından önce ve sonra yazılan metinler birbirine yapışmasın
          const text = needsSeparator && answer ? `\n\n${part.text}` : part.text
          needsSeparator = false
          answer += text
          emit({ conversationId, type: 'delta', text })
          break
        }
        case 'finish-step':
          needsSeparator = true
          break
        case 'tool-call':
          trackTool(part.toolCallId, part.toolName, 'running')
          break
        case 'tool-result':
          trackTool(part.toolCallId, part.toolName, 'done')
          break
        case 'tool-error':
          trackTool(part.toolCallId, part.toolName, 'error')
          break
        case 'error':
          throw part.error
      }
    }

    const finalTools = settleTools(tools)
    if (controller.signal.aborted) {
      emit({
        conversationId,
        type: 'stopped',
        message: savePartial(conversationId, answer, finalTools)
      })
      return
    }
    if (!answer.trim() && finalTools.length === 0) throw new Error('Model boş bir cevap döndürdü.')
    emit({
      conversationId,
      type: 'done',
      message: addMessage(conversationId, 'assistant', answer.trim() ? answer : '', finalTools)
    })
  } catch (err) {
    // Hata olsa bile o ana kadar yazılanlar ve kullanılan araçlar kaybolmasın
    const message = savePartial(conversationId, answer, settleTools(tools))
    if (controller.signal.aborted) {
      emit({ conversationId, type: 'stopped', message })
    } else {
      emit({ conversationId, type: 'error', error: describeError(err), message })
    }
  } finally {
    activeChats.delete(conversationId)
  }
}

function savePartial(
  conversationId: number,
  answer: string,
  tools: ToolActivity[]
): ChatMessage | null {
  if (!answer.trim() && tools.length === 0) return null
  try {
    return addMessage(conversationId, 'assistant', answer, tools)
  } catch {
    // Sohbet bu arada silinmiş olabilir
    return null
  }
}
