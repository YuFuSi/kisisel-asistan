import { streamText, type ModelMessage } from 'ai'
import type { WebContents } from 'electron'
import { addMessage, listMessages, setTitleIfEmpty } from '../conversations'
import { getModel } from './providers'
import { describeError } from './errors'
import type { ChatEvent, ChatMessage } from '../../shared/api'

// Modele gönderilecek en fazla geçmiş mesaj sayısı
const HISTORY_LIMIT = 40

// Şu an cevap yazılan sohbetler (durdurabilmek için)
const activeChats = new Map<number, AbortController>()

function buildInstructions(): string {
  const now = new Date().toLocaleString('tr-TR', { dateStyle: 'full', timeStyle: 'short' })
  return [
    'Sen kullanıcının bilgisayarında çalışan kişisel asistanısın.',
    'Kullanıcı hangi dilde yazarsa o dilde cevap ver; varsayılan dilin Türkçe.',
    'Net, samimi ve yardımsever ol; gereksiz uzun cevaplardan kaçın. Uygun olduğunda Markdown (liste, tablo, kod bloğu) kullan.',
    'Emin olmadığın bilgileri uydurma, emin değilsen açıkça söyle.',
    `Şu anki tarih ve saat: ${now}.`
  ].join('\n')
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

async function streamReply(
  sender: WebContents,
  conversationId: number,
  controller: AbortController
): Promise<void> {
  const emit = (event: ChatEvent): void => {
    if (!sender.isDestroyed()) sender.send('chat:event', event)
  }
  let answer = ''

  try {
    const messages = listMessages(conversationId)
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
      abortSignal: controller.signal
    })

    for await (const part of result.stream) {
      if (part.type === 'text-delta') {
        answer += part.text
        emit({ conversationId, type: 'delta', text: part.text })
      } else if (part.type === 'error') {
        throw part.error
      }
    }

    if (controller.signal.aborted) {
      emit({ conversationId, type: 'stopped', message: savePartial(conversationId, answer) })
      return
    }
    if (!answer.trim()) throw new Error('Model boş bir cevap döndürdü.')
    emit({ conversationId, type: 'done', message: addMessage(conversationId, 'assistant', answer) })
  } catch (err) {
    if (controller.signal.aborted) {
      emit({ conversationId, type: 'stopped', message: savePartial(conversationId, answer) })
    } else {
      emit({ conversationId, type: 'error', error: describeError(err) })
    }
  } finally {
    activeChats.delete(conversationId)
  }
}

// Durdurulan cevabın o ana kadar yazılan kısmını sakla
function savePartial(conversationId: number, answer: string): ChatMessage | null {
  if (!answer.trim()) return null
  try {
    return addMessage(conversationId, 'assistant', answer)
  } catch {
    // Sohbet bu arada silinmiş olabilir
    return null
  }
}
