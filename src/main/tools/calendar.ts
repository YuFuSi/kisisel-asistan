import { tool } from 'ai'
import { z } from 'zod'
import { googleRequest } from '../google/api'
import { parseLocalDate, parseLocalDateTime } from '../lib/datetime'
import { requireApproval } from './approval'
import type { ToolModule } from './types'

const CALENDAR = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const DEFAULT_DURATION_MS = 60 * 60_000
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

interface EventTime {
  dateTime?: string
  date?: string
}

interface CalendarEvent {
  id: string
  summary?: string
  location?: string
  start?: EventTime
  end?: EventTime
}

const formatEventTime = (time?: EventTime): string => {
  if (time?.date)
    return new Date(`${time.date}T12:00:00`).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      weekday: 'long'
    })
  if (!time?.dateTime) return ''
  return new Date(time.dateTime).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const calendarTools: ToolModule = {
  labels: {
    takvim_listele: 'Takvime bakma',
    etkinlik_ekle: 'Etkinlik ekleme'
  },
  tools: {
    takvim_listele: tool({
      description:
        'Google Takvim etkinliklerini listeler. "Bugün ne var", "bu hafta programım nasıl" gibi isteklerde kullan.',
      inputSchema: z.object({
        baslangicTarihi: z
          .string()
          .optional()
          .describe('Hangi günden itibaren bakılacağı, YYYY-MM-DD. Boşsa bugünden itibaren.'),
        gunSayisi: z.number().int().optional().describe('Kaç günlük aralık (varsayılan 1)')
      }),
      execute: async (input) => {
        const startDate = input.baslangicTarihi ? parseLocalDate(input.baslangicTarihi) : null
        const start = startDate ? new Date(`${startDate}T00:00:00`) : new Date()
        const days = Math.min(Math.max(input.gunSayisi ?? 1, 1), 31)
        const end = new Date(start)
        end.setDate(end.getDate() + days)

        const response = await googleRequest<{ items?: CalendarEvent[] }>(CALENDAR, {
          query: {
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 20,
            timeZone
          }
        })
        const etkinlikler = (response.items ?? []).map((event) => ({
          id: event.id,
          baslik: event.summary ?? '(başlıksız)',
          baslangic: formatEventTime(event.start),
          bitis: formatEventTime(event.end),
          konum: event.location ?? null,
          tumGun: Boolean(event.start?.date)
        }))
        return { bulunan: etkinlikler.length, etkinlikler }
      }
    }),

    etkinlik_ekle: tool({
      description:
        'Google Takvim’e yeni etkinlik ekler. Kullanıcıdan onay istenir. Göreli zamanları şu anki zamana göre hesapla.',
      inputSchema: z.object({
        baslik: z.string().describe('Etkinliğin adı'),
        baslangic: z.string().describe('Başlangıç, yerel saat, YYYY-MM-DDTHH:mm biçiminde'),
        bitis: z
          .string()
          .optional()
          .describe('Bitiş, YYYY-MM-DDTHH:mm. Boşsa başlangıçtan 1 saat sonrası kullanılır.'),
        konum: z.string().optional().describe('Varsa yer bilgisi'),
        aciklama: z.string().optional().describe('Varsa açıklama')
      }),
      execute: async (input) => {
        const start = parseLocalDateTime(input.baslangic)
        if (!start) throw new Error('Başlangıç zamanı YYYY-MM-DDTHH:mm biçiminde olmalı.')
        const end = input.bitis ? parseLocalDateTime(input.bitis) : null
        if (input.bitis && !end) throw new Error('Bitiş zamanı YYYY-MM-DDTHH:mm biçiminde olmalı.')
        const endTime = end ?? new Date(start.getTime() + DEFAULT_DURATION_MS)
        if (endTime <= start) throw new Error('Bitiş zamanı başlangıçtan sonra olmalı.')

        const readable = start.toLocaleString('tr-TR', {
          day: 'numeric',
          month: 'long',
          weekday: 'long',
          hour: '2-digit',
          minute: '2-digit'
        })
        await requireApproval({
          toolName: 'etkinlik_ekle',
          label: 'Takvime etkinlik eklensin mi?',
          summary: `${input.baslik} · ${readable}`,
          details: input.konum ? `Yer: ${input.konum}` : undefined
        })

        const created = await googleRequest<{ id: string; htmlLink?: string }>(CALENDAR, {
          method: 'POST',
          body: {
            summary: input.baslik,
            location: input.konum,
            description: input.aciklama,
            start: { dateTime: start.toISOString(), timeZone },
            end: { dateTime: endTime.toISOString(), timeZone }
          }
        })
        return { eklendi: true, id: created.id, baslik: input.baslik, baslangic: readable }
      }
    })
  }
}

export default calendarTools
