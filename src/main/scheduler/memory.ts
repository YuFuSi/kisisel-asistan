import { powerMonitor } from 'electron'
import { isAnyChatActive } from '../ai/chat'
import { processConversation } from '../ai/memoryProcessor'
import { listConversationsPendingDigest } from '../data/digests'
import { isDbOpen } from '../db'
import type { MemoryProcessingResult } from '../../shared/api'

// Hafıza işleyici zamanlayıcısı: bitmiş sohbetlerden (eskiler dahil) bilgi ve özet çıkarır.
// İşleyici sohbetle aynı yerel modeli kullandığı için sadece kullanıcı bir süredir bilgisayarı
// kullanmıyorken ve cevap yazılan bir sohbet yokken çalışır; böylece sohbet yavaşlamaz.

const CHECK_INTERVAL_MS = 60_000
// Son mesajdan bu kadar dakika sonra sohbet "bitmiş" sayılır
const CONVERSATION_IDLE_MINUTES = 10
// Kullanıcı en az bu kadar saniyedir klavye/fareye dokunmamış olmalı
const USER_IDLE_SECONDS = 120
// Ollama kapalıyken her dakika hata yazmasın: art arda hatada bekleme süresi
const BACKOFF_MS = 15 * 60_000

let running = false
let pausedUntil = 0
// Sesli oturum gibi "şimdi bitti" denen sohbetler sıradaki uygun anda önce işlenir
const priority = new Set<number>()

/** Sohbeti bekleme süresini beklemeden işlenecekler sırasına alır (ör. sesli oturum bitti) */
export function requestMemoryProcessing(conversationId: number): void {
  priority.add(conversationId)
}

/**
 * Bekleyen sohbetleri sırayla işler. `waitForIdle` açıkken kullanıcı dönerse veya bir sohbet
 * başlarsa kalanı sonraya bırakır. Ollama/model hatası yukarı fırlatılır.
 */
async function runQueue(waitForIdle: boolean): Promise<MemoryProcessingResult> {
  // Kullanıcı "şimdi işle" dediyse az önce biten sohbetler de beklemeden işlenir
  const idleMinutes = waitForIdle ? CONVERSATION_IDLE_MINUTES : 0
  const pending = listConversationsPendingDigest(idleMinutes).map((item) => item.conversationId)
  const queue = [...priority, ...pending.filter((id) => !priority.has(id))]
  priority.clear()
  const result: MemoryProcessingResult = { conversations: 0, added: 0, updated: 0, remaining: 0 }
  for (let i = 0; i < queue.length; i++) {
    const busy = isAnyChatActive()
    const userBack = waitForIdle && powerMonitor.getSystemIdleTime() < USER_IDLE_SECONDS
    if (busy || userBack) {
      result.remaining = queue.length - i
      for (const id of queue.slice(i)) priority.add(id)
      break
    }
    const conversationId = queue[i]
    const outcome = await processConversation(conversationId)
    result.conversations++
    result.added += outcome.added
    result.updated += outcome.updated
    if (outcome.added > 0 || outcome.updated > 0) {
      console.info(
        `Hafıza işleyici: sohbet ${conversationId} → ${outcome.added} yeni, ${outcome.updated} güncellenen bilgi`
      )
    }
  }
  return result
}

async function tick(): Promise<void> {
  if (running || Date.now() < pausedUntil || !isDbOpen()) return
  if (isAnyChatActive() || powerMonitor.getSystemIdleTime() < USER_IDLE_SECONDS) return
  running = true
  try {
    await runQueue(true)
  } catch (err) {
    // Genelde Ollama kapalı/model yok; bir süre sonra tekrar denenir, veri kaybı yok
    pausedUntil = Date.now() + BACKOFF_MS
    console.warn('Hafıza işleyici çalışamadı, 15 dk sonra yeniden denenecek:', err)
  } finally {
    running = false
  }
}

/** Kullanıcının isteğiyle (Hafıza Merkezi'nde "şimdi işle") boşta olmayı beklemeden işler */
export async function processPendingNow(): Promise<MemoryProcessingResult> {
  await waitForMemoryProcessing(60_000)
  if (running) throw new Error('Hafıza işleyici şu an çalışıyor, biraz sonra tekrar dene.')
  running = true
  try {
    pausedUntil = 0
    return await runQueue(false)
  } catch (err) {
    throw new Error(
      `Hafıza işlenemedi: ${err instanceof Error ? err.message : String(err)}. Ollama'nın açık olduğundan emin ol.`
    )
  } finally {
    running = false
  }
}

/** Zamanlayıcıyı başlatır. Durdurmak için dönen fonksiyon çağrılır. */
export function startMemoryScheduler(): () => void {
  const timer = setInterval(() => void tick(), CHECK_INTERVAL_MS)
  return () => clearInterval(timer)
}

/** Çıkışta yarım kalan işleme varsa bitmesini (en fazla verilen süre) bekler */
export async function waitForMemoryProcessing(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (running && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}
