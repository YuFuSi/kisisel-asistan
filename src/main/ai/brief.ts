import { listPendingReminders } from '../data/reminders'
import { listTasks } from '../data/tasks'
import { googleRequest } from '../google/api'
import { toLocalDate } from '../lib/datetime'
import { findPlace, getWeather } from '../lib/weather'
import { getSettings } from '../settings'
import { getPersonalNote } from './personalNote'

const GMAIL_INBOX = 'https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX'
const CALENDAR = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
// Özette gösterilecek en fazla görev
const TASK_LIMIT = 15

/** Sabah özetinin verisi. null olan bölümler alınamadı; nedeni `uyarilar` içinde yazar. */
export interface DailyBrief {
  tarih: string
  hava: {
    yer: string
    sicaklik: number
    durum: string
    enDusuk: number | null
    enYuksek: number | null
    yagisIhtimali: number | null
  } | null
  gorevler: { baslik: string; sonTarih: string | null; gecikmis: boolean }[]
  hatirlatmalar: { mesaj: string; saat: string }[]
  etkinlikler: { baslik: string; saat: string }[] | null
  okunmamisEposta: number | null
  /** Hafıza ve bugünün işlerinden yerel modelle yazılan kişisel not; üretilemezse null */
  kisiselNot: string | null
  uyarilar: string[]
}

const clock = (date: Date): string =>
  date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

const reason = (err: unknown): string => (err instanceof Error ? err.message : String(err))

interface CalendarEvent {
  summary?: string
  start?: { dateTime?: string; date?: string }
}

/** Hava, görevler, hatırlatmalar, takvim ve e-postayı tek seferde toplar. Bir bölüm hata verirse diğerleri yine gelir. */
export async function collectDailyBrief(now = new Date()): Promise<DailyBrief> {
  const settings = getSettings()
  const today = toLocalDate(now)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(startOfDay)
  endOfDay.setDate(endOfDay.getDate() + 1)
  const uyarilar: string[] = []

  // Bekleyen görevler: bugüne kadar olanlar ve tarihsizler
  const gorevler = listTasks()
    .filter((task) => task.doneAt === null && (task.dueDate === null || task.dueDate <= today))
    .slice(0, TASK_LIMIT)
    .map((task) => ({
      baslik: task.title,
      sonTarih: task.dueDate,
      gecikmis: task.dueDate !== null && task.dueDate < today
    }))

  const hatirlatmalar = listPendingReminders()
    .filter((r) => r.remindAt >= startOfDay.getTime() && r.remindAt < endOfDay.getTime())
    .map((r) => ({ mesaj: r.message, saat: clock(new Date(r.remindAt)) }))

  const weather = async (): Promise<DailyBrief['hava']> => {
    if (!settings.briefCity) {
      uyarilar.push("Hava durumu için Ayarlar > Uygulama'dan şehir seçilmedi.")
      return null
    }
    try {
      const report = await getWeather(await findPlace(settings.briefCity), 1)
      const day = report.gunler[0]
      return {
        yer: report.yer,
        sicaklik: report.simdi.sicaklik,
        durum: report.simdi.durum,
        enDusuk: day?.enDusuk ?? null,
        enYuksek: day?.enYuksek ?? null,
        yagisIhtimali: day?.yagisIhtimali ?? null
      }
    } catch (err) {
      uyarilar.push(`Hava durumu alınamadı: ${reason(err)}`)
      return null
    }
  }

  const googleConnected = settings.googleAccount !== null
  if (!googleConnected) uyarilar.push('Google hesabı bağlı değil; takvim ve e-posta eklenmedi.')

  const events = async (): Promise<DailyBrief['etkinlikler']> => {
    if (!googleConnected) return null
    try {
      const response = await googleRequest<{ items?: CalendarEvent[] }>(CALENDAR, {
        query: {
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 20
        }
      })
      return (response.items ?? []).map((event) => ({
        baslik: event.summary ?? '(başlıksız)',
        saat: event.start?.dateTime ? clock(new Date(event.start.dateTime)) : 'Tüm gün'
      }))
    } catch (err) {
      uyarilar.push(`Takvim alınamadı: ${reason(err)}`)
      return null
    }
  }

  const unread = async (): Promise<number | null> => {
    if (!googleConnected) return null
    try {
      const inbox = await googleRequest<{ messagesUnread?: number }>(GMAIL_INBOX)
      return inbox.messagesUnread ?? 0
    } catch (err) {
      uyarilar.push(`E-postalar alınamadı: ${reason(err)}`)
      return null
    }
  }

  const note = (): Promise<string | null> => getPersonalNote('brief', now).catch(() => null)
  const [hava, etkinlikler, okunmamisEposta, kisiselNot] = await Promise.all([
    weather(),
    events(),
    unread(),
    note()
  ])

  return {
    tarih: now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }),
    hava,
    gorevler,
    hatirlatmalar,
    etkinlikler,
    okunmamisEposta,
    kisiselNot,
    uyarilar
  }
}
