import { tool } from 'ai'
import { z } from 'zod'
import { googleRequest } from '../google/api'
import { getGoogleStatus } from '../google/auth'
import { buildRawMessage, isValidEmail } from '../lib/mime'
import { requireApproval } from './approval'
import type { ToolModule } from './types'

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'
const MAX_BODY = 3000

interface MessageList {
  messages?: { id: string }[]
}

interface MessagePart {
  mimeType?: string
  body?: { data?: string }
  parts?: MessagePart[]
}

interface Message {
  id: string
  threadId?: string
  snippet?: string
  internalDate?: string
  payload?: MessagePart & { headers?: { name: string; value: string }[] }
}

const messageUrl = (id: string): string => `${GMAIL}/messages/${encodeURIComponent(id)}`

const headerValue = (message: Message, name: string): string =>
  message.payload?.headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())
    ?.value ?? ''

// "Ahmet Yılmaz <ahmet@ornek.com>" → "ahmet@ornek.com"
const addressOf = (header: string): string => /<([^>]+)>/.exec(header)?.[1] ?? header.trim()

const formatDate = (message: Message): string =>
  message.internalDate
    ? new Date(Number(message.internalDate)).toLocaleString('tr-TR', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      })
    : ''

const preview = (text: string): string => (text.length > 300 ? `${text.slice(0, 300)}…` : text)

// Çok parçalı (multipart) postalarda düz metin bölümünü bul
function plainTextBody(part?: MessagePart): string {
  if (!part) return ''
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf8')
  }
  for (const child of part.parts ?? []) {
    const text = plainTextBody(child)
    if (text) return text
  }
  return ''
}

const getMetadata = (id: string): Promise<Message> =>
  googleRequest<Message>(messageUrl(id), { query: { format: 'metadata' } })

async function listMails(
  query: string,
  limit: number
): Promise<{ id: string; kimden: string; konu: string; tarih: string; ozet: string }[]> {
  const list = await googleRequest<MessageList>(`${GMAIL}/messages`, {
    query: { q: query, maxResults: Math.min(Math.max(limit, 1), 20) }
  })
  const messages = await Promise.all((list.messages ?? []).map((item) => getMetadata(item.id)))
  return messages.map((message) => ({
    id: message.id,
    kimden: headerValue(message, 'From'),
    konu: headerValue(message, 'Subject') || '(konu yok)',
    tarih: formatDate(message),
    ozet: message.snippet ?? ''
  }))
}

function requireAddress(address: string): string {
  const clean = address.trim()
  if (!isValidEmail(clean)) throw new Error(`"${address}" geçerli bir e-posta adresi değil.`)
  return clean
}

const gmailTools: ToolModule = {
  isAvailable: () => getGoogleStatus().connected,
  labels: {
    epostalari_ozetle: 'E-postalara bakma',
    eposta_ara: 'E-posta arama',
    eposta_oku: 'E-posta okuma',
    taslak_olustur: 'Taslak oluşturma',
    eposta_gonder: 'E-posta gönderme',
    eposta_yanitla: 'E-posta yanıtlama',
    eposta_isaretle: 'E-posta işaretleme',
    eposta_arsivle: 'E-posta arşivleme'
  },
  tools: {
    epostalari_ozetle: tool({
      description:
        'Gelen kutusundaki okunmamış e-postaları listeler. "Mailime bak", "yeni mail var mı" gibi isteklerde kullan.',
      inputSchema: z.object({
        sayi: z.number().int().optional().describe('Kaç e-posta getirileceği (varsayılan 8)')
      }),
      execute: async (input) => {
        const mailler = await listMails('is:unread in:inbox', input.sayi ?? 8)
        return { okunmamis: mailler.length, mailler }
      }
    }),

    eposta_ara: tool({
      description:
        'Gmail araması yapar. Gmail arama söz dizimini kullanabilirsin: from:ahmet, subject:fatura, newer_than:7d, has:attachment gibi.',
      inputSchema: z.object({
        sorgu: z.string().describe('Gmail arama sorgusu'),
        sayi: z.number().int().optional().describe('Kaç sonuç getirileceği (varsayılan 8)')
      }),
      execute: async (input) => {
        const mailler = await listMails(input.sorgu, input.sayi ?? 8)
        return { bulunan: mailler.length, mailler }
      }
    }),

    eposta_oku: tool({
      description:
        'Bir e-postanın tam metnini okur. id değerini epostalari_ozetle veya eposta_ara sonucundan al.',
      inputSchema: z.object({ id: z.string().describe('E-posta kimliği') }),
      execute: async (input) => {
        const message = await googleRequest<Message>(messageUrl(input.id), {
          query: { format: 'full' }
        })
        const body = plainTextBody(message.payload) || message.snippet || ''
        return {
          kimden: headerValue(message, 'From'),
          kime: headerValue(message, 'To'),
          konu: headerValue(message, 'Subject') || '(konu yok)',
          tarih: formatDate(message),
          icerik: body.length > MAX_BODY ? `${body.slice(0, MAX_BODY)}…` : body
        }
      }
    }),

    taslak_olustur: tool({
      description:
        'Gmail hesabında taslak e-posta oluşturur. Kullanıcı "taslak hazırla" derse veya göndermeden önce görmek isterse kullan.',
      inputSchema: z.object({
        kime: z.string().describe('Alıcının e-posta adresi'),
        konu: z.string().describe('E-postanın konusu'),
        icerik: z.string().describe('E-postanın metni')
      }),
      execute: async (input) => {
        const to = requireAddress(input.kime)
        const draft = await googleRequest<{ id: string }>(`${GMAIL}/drafts`, {
          method: 'POST',
          body: {
            message: { raw: buildRawMessage({ to, subject: input.konu, body: input.icerik }) }
          }
        })
        return { taslakOlusturuldu: true, id: draft.id, kime: to, konu: input.konu }
      }
    }),

    eposta_gonder: tool({
      description:
        'E-postayı gerçekten gönderir. Kullanıcıdan onay istenir. Emin değilsen önce taslak_olustur kullan.',
      inputSchema: z.object({
        kime: z.string().describe('Alıcının e-posta adresi'),
        konu: z.string().describe('E-postanın konusu'),
        icerik: z.string().describe('E-postanın metni')
      }),
      execute: async (input) => {
        const to = requireAddress(input.kime)

        await requireApproval({
          toolName: 'eposta_gonder',
          label: 'E-posta gönderilsin mi?',
          summary: `${to} · ${input.konu}`,
          details: preview(input.icerik)
        })

        const sent = await googleRequest<{ id: string }>(`${GMAIL}/messages/send`, {
          method: 'POST',
          body: { raw: buildRawMessage({ to, subject: input.konu, body: input.icerik }) }
        })
        return { gonderildi: true, id: sent.id, kime: to, konu: input.konu }
      }
    }),

    eposta_yanitla: tool({
      description:
        'Bir e-postayı aynı konuşma içinde yanıtlar ve gönderir. Kullanıcıdan onay istenir. id değerini epostalari_ozetle veya eposta_ara sonucundan al.',
      inputSchema: z.object({
        id: z.string().describe('Yanıtlanacak e-postanın kimliği'),
        icerik: z.string().describe('Yanıtın metni')
      }),
      execute: async (input) => {
        const original = await getMetadata(input.id)
        const to = requireAddress(
          addressOf(headerValue(original, 'Reply-To') || headerValue(original, 'From'))
        )
        const originalSubject = headerValue(original, 'Subject')
        const subject = /^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`

        await requireApproval({
          toolName: 'eposta_yanitla',
          label: 'Yanıt gönderilsin mi?',
          summary: `${to} · ${subject}`,
          details: preview(input.icerik)
        })

        const raw = buildRawMessage({
          to,
          subject,
          body: input.icerik,
          inReplyTo: headerValue(original, 'Message-ID')
        })
        const sent = await googleRequest<{ id: string }>(`${GMAIL}/messages/send`, {
          method: 'POST',
          body: { raw, threadId: original.threadId }
        })
        return { gonderildi: true, id: sent.id, kime: to, konu: subject }
      }
    }),

    eposta_isaretle: tool({
      description: 'Bir e-postayı okundu veya okunmadı olarak işaretler.',
      inputSchema: z.object({
        id: z.string().describe('E-posta kimliği'),
        okundu: z.boolean().describe('true: okundu yap, false: okunmadı yap')
      }),
      execute: async (input) => {
        await googleRequest(`${messageUrl(input.id)}/modify`, {
          method: 'POST',
          body: input.okundu ? { removeLabelIds: ['UNREAD'] } : { addLabelIds: ['UNREAD'] }
        })
        return { id: input.id, okundu: input.okundu }
      }
    }),

    eposta_arsivle: tool({
      description:
        'Bir e-postayı gelen kutusundan kaldırıp arşivler (silinmez, "Tüm Postalar"da durur). Kullanıcıdan onay istenir.',
      inputSchema: z.object({ id: z.string().describe('E-posta kimliği') }),
      execute: async (input) => {
        const message = await getMetadata(input.id)
        await requireApproval({
          toolName: 'eposta_arsivle',
          label: 'E-posta arşivlensin mi?',
          summary: headerValue(message, 'Subject') || '(konu yok)',
          details: headerValue(message, 'From')
        })
        await googleRequest(`${messageUrl(input.id)}/modify`, {
          method: 'POST',
          body: { removeLabelIds: ['INBOX'] }
        })
        return { id: input.id, arsivlendi: true }
      }
    })
  }
}

export default gmailTools
