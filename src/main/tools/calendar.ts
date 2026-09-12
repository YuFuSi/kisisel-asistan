import { tool } from 'ai'
import { z } from 'zod'
import { googleRequest } from '../google/api'
import { getGoogleStatus } from '../google/auth'
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

const eventUrl = (id: string): string => `${CALENDAR}/${encodeURIComponent(id)}`

const readableTime = (date: Date): string =>
  date.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })

const formatEventTime = (time?: EventTime): string => {
  if (time?.date)
    return new Date(`${time.date}T12:00:00`).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      weekday: 'long'
    })
  if (!time?.dateTime) return ''
  return readableTime(new Date(time.dateTime))
}

const calendarTools: ToolModule = {
  isAvailable: () => getGoogleStatus().connected,
  labels: {
    takvim_listele: 'Takvime bakma',
    etkinlik_ekle: 'Etkinlik ekleme',
    etkinlik_guncelle: 'Etkinlik güncelleme',
    etkinlik_sil: 'Etkinlik silme'
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
        'Google Takvim’e yeni etkinlik ekler; SADECE kullanıcı takvim, toplantı, randevu veya etkinlik derse kullan. "... hatırlat" isteklerinde bunu değil hatirlatma_kur aracını kullan. Kullanıcıdan onay istenir. Göreli zamanları şu anki zamana göre hesapla.',
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

        const readable = readableTime(start)
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
    }),

    etkinlik_guncelle: tool({
      description:
        'Var olan bir takvim etkinliğini değiştirir (başlık, zaman, yer, açıklama). Sadece değişecek alanları doldur. id değerini takvim_listele sonucundan al. Kullanıcıdan onay istenir.',
      inputSchema: z.object({
        id: z.string().describe('Etkinlik kimliği'),
        baslik: z.string().optional().describe('SADECE değişecekse yeni başlık'),
        baslangic: z
          .string()
          .optional()
          .describe('SADECE değişecekse yeni başlangıç, YYYY-MM-DDTHH:mm'),
        bitis: z.string().optional().describe('SADECE değişecekse yeni bitiş, YYYY-MM-DDTHH:mm'),
        konum: z.string().optional().describe('SADECE değişecekse yeni yer'),
        aciklama: z.string().optional().describe('SADECE değişecekse yeni açıklama')
      }),
      execute: async (input) => {
        const current = await googleRequest<CalendarEvent>(eventUrl(input.id))
        const patch: Record<string, unknown> = {}
        const changes: string[] = []

        if (input.baslik) {
          patch.summary = input.baslik
          changes.push(`Başlık: ${input.baslik}`)
        }
        if (input.konum !== undefined) {
          patch.location = input.konum
          changes.push(`Yer: ${input.konum}`)
        }
        if (input.aciklama !== undefined) {
          patch.description = input.aciklama
          changes.push('Açıklama')
        }

        if (input.baslangic || input.bitis) {
          const oldStart = current.start?.dateTime ? new Date(current.start.dateTime) : null
          const oldEnd = current.end?.dateTime ? new Date(current.end.dateTime) : null
          const start = input.baslangic ? parseLocalDateTime(input.baslangic) : oldStart
          if (!start) throw new Error('Başlangıç zamanı YYYY-MM-DDTHH:mm biçiminde olmalı.')
          // Sadece başlangıç değişirse etkinliğin süresi korunur
          const duration =
            oldStart && oldEnd ? oldEnd.getTime() - oldStart.getTime() : DEFAULT_DURATION_MS
          const end = input.bitis
            ? parseLocalDateTime(input.bitis)
            : new Date(start.getTime() + duration)
          if (!end) throw new Error('Bitiş zamanı YYYY-MM-DDTHH:mm biçiminde olmalı.')
          if (end <= start) throw new Error('Bitiş zamanı başlangıçtan sonra olmalı.')
          patch.start = { dateTime: start.toISOString(), timeZone }
          patch.end = { dateTime: end.toISOString(), timeZone }
          changes.push(`Zaman: ${readableTime(start)}`)
        }

        if (changes.length === 0) throw new Error('Değiştirilecek bir alan verilmedi.')

        await requireApproval({
          toolName: 'etkinlik_guncelle',
          label: 'Etkinlik güncellensin mi?',
          summary: current.summary ?? '(başlıksız)',
          details: changes.join(' · ')
        })

        await googleRequest(eventUrl(input.id), { method: 'PATCH', body: patch })
        return { guncellendi: true, id: input.id, degisiklikler: changes }
      }
    }),

    etkinlik_sil: tool({
      description:
        'Bir takvim etkinliğini siler. id değerini takvim_listele sonucundan al. Kullanıcıdan onay istenir.',
      inputSchema: z.object({ id: z.string().describe('Etkinlik kimliği') }),
      execute: async (input) => {
        const current = await googleRequest<CalendarEvent>(eventUrl(input.id))
        await requireApproval({
          toolName: 'etkinlik_sil',
          label: 'Etkinlik silinsin mi?',
          summary: current.summary ?? '(başlıksız)',
          details: formatEventTime(current.start)
        })
        await googleRequest(eventUrl(input.id), { method: 'DELETE' })
        return { silindi: true, id: input.id, baslik: current.summary ?? '(başlıksız)' }
      }
    })
  }
}

export default calendarTools
