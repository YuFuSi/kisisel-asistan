import { generateText, isStepCount, streamText } from 'ai'
import type { WebContents } from 'electron'
import {
  addMessage,
  deleteMessage,
  deleteMessagesFrom,
  clearGeneratedTitle,
  getConversationSummary,
  listMessages,
  setConversationSummary,
  setGeneratedTitle,
  setTitleIfEmpty
} from '../data/conversations'
import { listMemories } from '../data/memories'
import { notifyDataChanged } from '../events'
import { toLocalIso } from '../lib/datetime'
import { rankMemories } from '../lib/memoryRank'
import { cleanTitle } from '../lib/title'
import { summarizeToolOutput, toModelMessages } from '../lib/toolHistory'
import { getSecret, getSettings } from '../settings'
import { splitAttachments } from '../../shared/attachments'
import { getGoogleStatus } from '../google/auth'
import { getAssistantTools, toolLabel } from '../tools'
import { cancelApprovals } from '../tools/approval'
import { runWithToolContext } from '../tools/context'
import { getModel, getModelOptions } from './providers'
import { describeError } from './errors'
import type {
  AssistantTone,
  ChatEvent,
  ChatMessage,
  ToolActivity,
  ToolStatus
} from '../../shared/api'

// Modele tam olarak gönderilecek en fazla geçmiş mesaj sayısı; daha eskileri özetlenir
const HISTORY_LIMIT = 40
// Bir cevapta en fazla kaç adım (araç çağrısı + cevap) yapılabilir
const MAX_STEPS = 6
// Sistem talimatına eklenecek en fazla hafıza kaydı (fazlası alakaya göre seçilir)
const MEMORY_LIMIT = 30
// Özet, eski kısımda en az bu kadar yeni mesaj birikince güncellenir
const SUMMARY_BATCH = 10
// Tek seferde özetlenecek en fazla mesaj (çok eski uzun sohbetler küçük modeli boğmasın)
const SUMMARY_MAX_MESSAGES = 40
const SUMMARY_LENGTH_LIMIT = 2500

const TONE_INSTRUCTIONS: Record<AssistantTone, string> = {
  dengeli: 'Net, samimi ve yardımsever ol; gereksiz uzun cevaplardan kaçın.',
  samimi:
    'Sıcak, arkadaşça ve rahat bir dille konuş; "sen" diye hitap et, yerinde hafif espri yapabilirsin.',
  resmi: 'Resmi ve saygılı bir dil kullan; "siz" diye hitap et, argo ve espri kullanma.',
  kisa: 'Çok kısa ve öz cevap ver; giriş, tekrar ve kapanış cümlesi yazma.'
}

// Şu an cevap yazılan sohbetler (durdurabilmek için)
const activeChats = new Map<number, AbortController>()

/**
 * Sistem talimatı. `query` son kullanıcı mesajıdır: hafıza kayıtları buna göre seçilir.
 * `summary` sohbetin modele artık tam gönderilmeyen eski kısmının özetidir.
 */
function buildInstructions(query: string, summary: string): string {
  const settings = getSettings()
  const googleConnected = getGoogleStatus().connected
  const searchAvailable = getSecret('tavily') !== undefined
  const now = new Date()
  const weekday = now.toLocaleDateString('tr-TR', { weekday: 'long' })
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const lines = [
    'Senin adın Jarvis. Kullanıcının bilgisayarında çalışan kişisel yapay zeka asistanısın.',
    'Kullanıcı hangi dilde yazarsa o dilde cevap ver; varsayılan dilin Türkçe.',
    TONE_INSTRUCTIONS[settings.tone],
    'Uygun olduğunda Markdown kullan. Emin olmadığın bilgileri uydurma, emin değilsen açıkça söyle.',
    '',
    `Şu anki yerel zaman: ${toLocalIso(now)} (${weekday}), saat dilimi: ${timeZone}.`,
    '"Yarın", "haftaya", "2 saat sonra" gibi ifadeleri bu zamana göre hesapla.',
    '',
    'Araçların hakkında:',
    '- Görev, hatırlatma, not ve hafıza işlemlerini gerçekten araç çağırarak yap; araç çağırmadan yapmış gibi davranma.',
    '- Önceki cevaplarında kullandığın araçların girdileri ve sonuçları geçmişte durur; "az önce eklediğin görev" gibi isteklerde oradaki numaraları kullan.',
    '- "... hatırlat" (belirli bir zamanda bildirim) için HER ZAMAN hatirlatma_kur kullan, takvim araçlarını değil. "Her gün / hafta içi / her hafta" gibi tekrar istenirse tekrar alanını doldur. Takvim araçlarını sadece kullanıcı takvim, toplantı veya etkinlik derse kullan.',
    '- "Bunu hatırla / aklında tut" denirse veya kullanıcı kendisi hakkında kalıcı bir bilgi paylaşırsa hafizaya_kaydet kullan. "Bunu unut" denirse hafizayi_listele ile kaydı bulup hafizadan_sil kullan.',
    searchAvailable
      ? '- Hava durumu, internette arama, sistem bilgisi, dosya arama ve uygulama açma araçların da var.'
      : '- Hava durumu, sistem bilgisi, dosya arama ve uygulama açma araçların var. İnternette arama kapalı (Tavily anahtarı yok); güncel bilgi istenirse Ayarlar > Servisler bölümünü söyle.',
    googleConnected
      ? '- Gmail ve Google Takvim araçların var: mail okuma, arama, taslak, gönderme ve yanıtlama (onaylı), okundu işaretleme, arşivleme (onaylı); takvimi listeleme, etkinlik ekleme, güncelleme ve silme (onaylı).'
      : '- Google hesabı bağlı değil, bu yüzden mail ve takvim araçların yok. Mail veya takvim istenirse Ayarlar > Google bölümünden hesabı bağlamasını söyle.',
    '- Belge okuma (belge_oku: PDF, Word, metin), pano okuma/yazma (pano_oku, pano_yaz) ve günlük özet (gunluk_ozet) araçların var.',
    '- "Günlük özetimi hazırla", "bugün neler var" denirse gunluk_ozet kullan; sonucu kısa başlıklarla (hava, takvim, görevler, e-posta) özetle.',
    '- Kullanıcı sohbete belge eklediyse belgenin metni mesajda <belge> etiketleri arasında gelir. Belge metnini cevabında aynen tekrar yazma; soruyu belgeye göre cevapla. Belgenin devamı varsa belge_oku ile sonraki bölümleri oku.',
    '- Uygulama veya dosya açmadan önce kullanıcıya onay kartı gösterilir; onaylamazsa işlem yapılmaz.',
    '- Onay kartı kendiliğinden çıkar; kullanıcıya ayrıca "onaylıyor musun" diye sorma, aracı doğrudan çağır.',
    '- Araç kullandıktan sonra ne yaptığını kısaca söyle.'
  ]

  if (settings.aboutMe) {
    lines.push('', 'Kullanıcının kendisi hakkında yazdıkları:', settings.aboutMe)
  }

  const memories = rankMemories(listMemories(), query, MEMORY_LIMIT)
  if (memories.length > 0) {
    lines.push(
      '',
      'Kullanıcı hakkında bildiklerin (hafıza):',
      ...memories.map((m) => `- ${m.content}`)
    )
  }

  if (summary) {
    lines.push(
      '',
      'Bu sohbetin daha önceki kısmının özeti (eski mesajlar sana gönderilmiyor):',
      summary
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
  // Başlığa eklenen belgenin metni değil, kullanıcının yazdığı kısım girsin
  setTitleIfEmpty(conversationId, splitAttachments(content).text || content)
  notifyDataChanged('conversations')
  startReply(sender, conversationId)
  return userMessage
}

/** Son asistan cevabını silip aynı soruya yeniden cevap yazdırır */
export function regenerateReply(sender: WebContents, conversationId: number): void {
  if (activeChats.has(conversationId)) throw new Error('Bu sohbette zaten bir cevap yazılıyor.')
  getModel()

  const messages = listMessages(conversationId)
  const last = messages[messages.length - 1]
  if (!last) throw new Error('Bu sohbette henüz mesaj yok.')
  if (last.role === 'assistant') deleteMessage(last.id)
  if (!messages.some((m) => m.role === 'user')) throw new Error('Cevaplanacak bir soru yok.')

  startReply(sender, conversationId)
}

/** Bir kullanıcı mesajını değiştirir; o mesaj ve sonrası silinip sohbet yeniden yazılır */
export function editAndResend(
  sender: WebContents,
  conversationId: number,
  messageId: number,
  text: string
): ChatMessage {
  const content = text.trim()
  if (!content) throw new Error('Boş mesaj gönderilemez.')
  if (activeChats.has(conversationId)) throw new Error('Bu sohbette zaten bir cevap yazılıyor.')
  getModel()

  const target = listMessages(conversationId).find((m) => m.id === messageId)
  if (!target || target.role !== 'user') throw new Error('Düzenlenecek mesaj bulunamadı.')

  deleteMessagesFrom(conversationId, messageId)
  // İlk mesaj değiştiyse sohbet baştan başlıyor demektir; başlık da yenilensin
  if (listMessages(conversationId).length === 0) clearGeneratedTitle(conversationId)

  const userMessage = addMessage(conversationId, 'user', content)
  // Başlığa eklenen belgenin metni değil, kullanıcının yazdığı kısım girsin
  setTitleIfEmpty(conversationId, splitAttachments(content).text || content)
  notifyDataChanged('conversations')
  startReply(sender, conversationId)
  return userMessage
}

function startReply(sender: WebContents, conversationId: number): void {
  const controller = new AbortController()
  activeChats.set(conversationId, controller)
  // Cevap akışı bu IPC çağrısı döndükten sonra başlasın; böylece arayüz önce kullanıcı mesajını alır
  setImmediate(() => void streamReply(sender, conversationId, controller))
}

export function stopChat(conversationId: number): void {
  // Bekleyen onay kartı varsa iptal edilir, yoksa araç cevabı beklemeye devam eder
  cancelApprovals(conversationId)
  activeChats.get(conversationId)?.abort()
}

// Yarıda kalan (hâlâ "çalışıyor" görünen) araçları başarısız say
const settleTools = (tools: ToolActivity[]): ToolActivity[] =>
  tools.map((t) =>
    t.status === 'running' ? { ...t, status: 'error', result: t.result ?? 'Yarıda kaldı.' } : t
  )

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

  const trackTool = (
    id: string,
    name: string,
    status: ToolStatus,
    extra: Pick<ToolActivity, 'input' | 'result'> = {}
  ): void => {
    const index = tools.findIndex((t) => t.id === id)
    const activity: ToolActivity = {
      ...(index === -1 ? {} : tools[index]),
      ...extra,
      id,
      name,
      label: toolLabel(name),
      status
    }
    if (index === -1) tools.push(activity)
    else tools[index] = activity
    emit({ conversationId, type: 'tool', activity })
  }

  try {
    const all = listMessages(conversationId)
    const recent = all.slice(-HISTORY_LIMIT)
    const lastUser = [...recent].reverse().find((m) => m.role === 'user')
    const query = lastUser ? splitAttachments(lastUser.content).text : ''
    const summary = all.length > HISTORY_LIMIT ? getConversationSummary(conversationId).summary : ''

    // Araçlar hangi sohbette çalıştıklarını bu bağlamdan öğrenir (onay kartı göndermek için gerekli)
    await runWithToolContext({ conversationId, sender, source: 'chat' }, async () => {
      const result = streamText({
        model: getModel(),
        instructions: buildInstructions(query, summary),
        messages: toModelMessages(recent),
        tools: getAssistantTools(),
        stopWhen: isStepCount(MAX_STEPS),
        abortSignal: controller.signal,
        ...getModelOptions()
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
            trackTool(part.toolCallId, part.toolName, 'running', { input: part.input })
            break
          case 'tool-result':
            trackTool(part.toolCallId, part.toolName, 'done', {
              result: summarizeToolOutput(part.output)
            })
            break
          case 'tool-error': {
            const reason = part.error instanceof Error ? part.error.message : String(part.error)
            // Modelin araca ne gönderdiği ve neden başarısız olduğu sorun ayıklarken gerekli
            console.warn(`Araç hatası (${part.toolName}):`, reason, JSON.stringify(part.input))
            trackTool(part.toolCallId, part.toolName, 'error', {
              input: part.input,
              result: summarizeToolOutput(reason)
            })
            break
          }
          case 'error':
            throw part.error
        }
      }
    })

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
    void nameConversation(conversationId)
    void updateSummary(conversationId)
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
    // Sohbetin sırası (son güncelleme) değişti; liste kendini yenilesin
    notifyDataChanged('conversations')
  }
}

/**
 * İlk soru-cevap tamamlandığında sohbete modele başlık ürettirir.
 * Sonraki cevaplarda çalışmaz; böylece kullanıcının verdiği ad korunur.
 */
async function nameConversation(conversationId: number): Promise<void> {
  try {
    const messages = listMessages(conversationId)
    if (messages.length !== 2) return

    const { text } = await generateText({
      model: getModel(),
      instructions:
        'Sana bir soru ve cevabı verilecek. Bu sohbet için en fazla 5 kelimelik kısa bir başlık yaz. ' +
        'Sadece başlığı yaz: tırnak, noktalama, açıklama veya "Başlık:" gibi bir önek ekleme. ' +
        'Başlık, konuşmanın dilinde olsun.',
      prompt: `Soru: ${splitAttachments(messages[0].content).text.slice(0, 500)}\nCevap: ${messages[1].content.slice(0, 500)}`
    })

    const title = cleanTitle(text)
    if (!title) return
    // Kullanıcı sohbeti kendi adlandırdıysa bu çağrı bir şey değiştirmez
    setGeneratedTitle(conversationId, title)
    notifyDataChanged('conversations')
  } catch {
    // Başlık üretilemezse ilk mesajdan kırpılan başlık kalır
  }
}

/**
 * Sohbet HISTORY_LIMIT mesajı aşınca modele gönderilmeyen eski kısmı özetler.
 * Cevaptan sonra arka planda çalışır; özet bir sonraki cevapta sistem talimatına eklenir.
 */
async function updateSummary(conversationId: number): Promise<void> {
  try {
    const all = listMessages(conversationId)
    if (all.length <= HISTORY_LIMIT) return
    const older = all.slice(0, all.length - HISTORY_LIMIT)
    const { summary, until } = getConversationSummary(conversationId)
    const pending = older.filter((m) => m.id > until).slice(0, SUMMARY_MAX_MESSAGES)
    if (pending.length < SUMMARY_BATCH) return

    const transcript = pending
      .map((m) => {
        const speaker = m.role === 'user' ? 'Kullanıcı' : 'Asistan'
        return `${speaker}: ${splitAttachments(m.content).text.slice(0, 800)}`
      })
      .join('\n')

    const { text } = await generateText({
      model: getModel(),
      instructions:
        'Bir sohbetin eski kısmını özetliyorsun. Kullanıcının istekleri, verilen kararlar, önemli bilgiler ' +
        '(isimler, tarihler, sayılar) ve yarım kalan işler kalsın. Mevcut özet varsa yeni mesajlarla birleştir. ' +
        'En fazla 12 kısa madde halinde, Türkçe yaz. Sadece özeti yaz.',
      prompt: `${summary ? `Mevcut özet:\n${summary}\n\n` : ''}Özete eklenecek mesajlar:\n${transcript}`,
      ...getModelOptions()
    })

    const clean = text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim()
      .slice(0, SUMMARY_LENGTH_LIMIT)
    if (!clean) return
    setConversationSummary(conversationId, clean, pending[pending.length - 1].id)
  } catch (err) {
    console.warn('Sohbet özeti güncellenemedi:', err)
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
