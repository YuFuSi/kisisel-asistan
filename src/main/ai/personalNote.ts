import { generateText } from 'ai'
import { listMemories } from '../data/memories'
import { listPendingReminders } from '../data/reminders'
import { listTasks } from '../data/tasks'
import { fetchCalendarEvents, toCalendarItem } from '../google/calendar'
import { getGoogleStatus } from '../google/auth'
import { toLocalDate } from '../lib/datetime'
import {
  buildPersonalNotePrompt,
  cleanPersonalNote,
  type PersonalContext,
  type PersonalNoteKind
} from '../lib/personalNote'
import { getLocalModel, getLocalModelOptions } from './providers'

// Kişisel not (Ana Sayfa karşılaması ve sabah özetinin başı): hafıza + bugünün işleri + takvim
// yerel modelle 1-2 cümleye dönüşür. Kişisel bilgi olduğu için hep yerel model. Aynı bağlam için
// 30 dk önbelleğe alınır; model kullanılamazsa null döner ve çağıran düz özete düşer.

const CACHE_MS = 30 * 60_000
// Üretilemediyse (Ollama kapalı, model yükleniyor) kısa süre sonra yeniden denensin
const FAILED_CACHE_MS = 2 * 60_000
const UPCOMING_DAYS = 30
const UPCOMING_LIMIT = 8
const TASK_LIMIT = 8
const MODEL_TIMEOUT_MS = 60_000

interface CacheEntry {
  key: string
  text: string | null
  at: number
}

const cache = new Map<PersonalNoteKind, CacheEntry>()
const inFlight = new Map<string, Promise<string | null>>()

const clock = (date: Date): string =>
  date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

// SQLite datetime('now') UTC ve işaretsiz
const parseUtc = (value: string): Date => new Date(`${value.replace(' ', 'T')}Z`)

async function todayEvents(now: Date): Promise<PersonalContext['events']> {
  if (!getGoogleStatus().connected) return null
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  try {
    const events = await fetchCalendarEvents(start, end, 20)
    return events.flatMap((event) => {
      const item = toCalendarItem(event)
      if (!item) return []
      return [{ title: item.title, time: item.allDay ? 'Tüm gün' : clock(new Date(item.start)) }]
    })
  } catch (err) {
    console.warn('Kişisel not için takvim alınamadı:', err)
    return null
  }
}

/** Notun dayandığı bilgiler (testte ve önbellek anahtarında kullanılır) */
export async function collectPersonalContext(now: Date): Promise<PersonalContext> {
  const today = toLocalDate(now)
  const memories = listMemories()
  const since = now.getTime() - UPCOMING_DAYS * 24 * 60 * 60_000
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const endOfDay = startOfDay + 24 * 60 * 60_000

  return {
    profile: memories.filter((m) => m.kind === 'profil').map((m) => m.content),
    upcoming: memories
      .filter(
        (m) => (m.kind === 'plan' || m.kind === 'olay') && parseUtc(m.createdAt).getTime() >= since
      )
      .slice(-UPCOMING_LIMIT)
      .map((m) => ({
        content: m.content,
        learnedAt: parseUtc(m.createdAt).toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'long'
        })
      })),
    tasks: listTasks()
      .filter((t) => t.doneAt === null && t.dueDate !== null && t.dueDate <= today)
      .slice(0, TASK_LIMIT)
      .map((t) => ({ title: t.title, time: t.dueTime, overdue: t.dueDate! < today })),
    reminders: listPendingReminders()
      .filter((r) => r.remindAt >= now.getTime() && r.remindAt < endOfDay)
      .map((r) => ({ message: r.message, time: clock(new Date(r.remindAt)) })),
    events: await todayEvents(now)
  }
}

async function generate(
  context: PersonalContext,
  kind: PersonalNoteKind,
  now: Date
): Promise<string | null> {
  const { instructions, prompt } = buildPersonalNotePrompt(context, kind, now)
  try {
    const { text } = await generateText({
      model: getLocalModel(),
      ...getLocalModelOptions(),
      instructions,
      prompt,
      temperature: 0.5,
      abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS)
    })
    return cleanPersonalNote(text)
  } catch (err) {
    console.warn('Kişisel not üretilemedi, düz özet kullanılacak:', err)
    return null
  }
}

/**
 * Kişisel notu döndürür (önbellekten veya üreterek). Bağlam (görev, hatırlatma, hafıza, takvim)
 * değişmediyse 30 dk boyunca aynı not kullanılır; değişince yeniden üretilir.
 */
export async function getPersonalNote(
  kind: PersonalNoteKind,
  now = new Date()
): Promise<string | null> {
  const context = await collectPersonalContext(now)
  const key = `${kind}|${toLocalDate(now)}|${JSON.stringify(context)}`
  const cached = cache.get(kind)
  const ttl = cached?.text === null ? FAILED_CACHE_MS : CACHE_MS
  if (cached && cached.key === key && Date.now() - cached.at < ttl) return cached.text

  const running = inFlight.get(key)
  if (running) return running
  const job = generate(context, kind, now).then((text) => {
    cache.set(kind, { key, text, at: Date.now() })
    return text
  })
  inFlight.set(key, job)
  try {
    return await job
  } finally {
    inFlight.delete(key)
  }
}
