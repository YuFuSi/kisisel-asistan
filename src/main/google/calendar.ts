import { googleRequest } from './api'
import type { CalendarItem } from '../../shared/api'

export const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

export interface EventTime {
  dateTime?: string
  date?: string
}

export interface GoogleCalendarEvent {
  id: string
  summary?: string
  location?: string
  start?: EventTime
  end?: EventTime
}

/** Aralıktaki etkinlikler; tekrarlayan etkinlikler tek tek gelir, başlangıca göre sıralı */
export async function fetchCalendarEvents(
  start: Date,
  end: Date,
  maxResults: number
): Promise<GoogleCalendarEvent[]> {
  const response = await googleRequest<{ items?: GoogleCalendarEvent[] }>(CALENDAR_EVENTS_URL, {
    query: {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults,
      timeZone
    }
  })
  return response.items ?? []
}

function toMs(time?: EventTime): number | null {
  if (time?.dateTime) return new Date(time.dateTime).getTime()
  if (time?.date) {
    // Tüm gün etkinliği: "2026-09-14" yerel günün başlangıcı
    const [year, month, day] = time.date.split('-').map(Number)
    return new Date(year, month - 1, day).getTime()
  }
  return null
}

export function toCalendarItem(event: GoogleCalendarEvent): CalendarItem | null {
  const start = toMs(event.start)
  if (start === null) return null
  return {
    id: event.id,
    title: event.summary ?? '(başlıksız)',
    start,
    end: toMs(event.end),
    allDay: Boolean(event.start?.date),
    location: event.location ?? null
  }
}
