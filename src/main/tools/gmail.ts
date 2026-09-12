import { tool } from 'ai'
import { z } from 'zod'
import { googleRequest } from '../google/api'
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
  snippet?: string
  internalDate?: string
  payload?: MessagePart & { headers?: { name: string; value: string }[] }
}

const headerValue = (message: Message, name: string): string =>
  message.payload?.headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())
    ?.value ?? ''

const formatDate = (message: Message): string =>
  message.internalDate
    ? new Date(Number(message.internalDate)).toLocaleString('tr-TR', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      })
    : ''

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

async function listMails(
  query: string,
  limit: number
): Promise<{ id: string; kimden: string; konu: string; tarih: string; ozet: string }[]> {
  const list = await googleRequest<MessageList>(`${GMAIL}/messages`, {
    query: { q: query, maxResults: Math.min(Math.max(limit, 1), 20) }
  })
  const messages = await Promise.all(
    (list.messages ?? []).map((item) =>
      googleRequest<Message>(`${GMAIL}/messages/${item.id}`, { query: { format: 'metadata' } })
    )
  )
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
  labels: {
    epostalari_ozetle: 'E-postalara bakma',
    eposta_ara: 'E-posta arama',
    eposta_oku: 'E-posta okuma',
    taslak_olustur: 'Taslak oluşturma',
    eposta_gonder: 'E-posta gönderme'
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
        const message = await googleRequest<Message>(`${GMAIL}/messages/${input.id}`, {
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
        const preview = input.icerik.length > 300 ? `${input.icerik.slice(0, 300)}…` : input.icerik

        await requireApproval({
          toolName: 'eposta_gonder',
          label: 'E-posta gönderilsin mi?',
          summary: `${to} · ${input.konu}`,
          details: preview
        })

        const sent = await googleRequest<{ id: string }>(`${GMAIL}/messages/send`, {
          method: 'POST',
          body: { raw: buildRawMessage({ to, subject: input.konu, body: input.icerik }) }
        })
        return { gonderildi: true, id: sent.id, kime: to, konu: input.konu }
      }
    })
  }
}

export default gmailTools
