import { Notification } from 'electron'
import icon from '../../../resources/icon.png?asset'
import { runAutomationTurn } from '../ai/automation'
import {
  finishAutomationRun,
  recordAutomationRunStart,
  takeDueAutomations
} from '../data/automations'
import { notifyDataChanged } from '../events'
import { notifyPulse, sendCommand, showMainWindow } from '../system/window'
import type { Automation, AutomationRun } from '../../shared/api'

const CHECK_INTERVAL_MS = 30_000

// Aynı rutin aynı anda iki kez çalışmasın diye: zamanlayıcı ile "Şimdi çalıştır" (veya art arda
// iki "Şimdi çalıştır" tıklaması) çakışabilir. Süreç içi kilit yeterli; iki ayrı Jarvis kopyası
// zaten tek kopya kilidiyle (requestSingleInstanceLock) engelleniyor.
const runningAutomationIds = new Set<number>()

// Uygulama kapanırken devam eden çalıştırmaları bekleyebilmek için (bkz. waitForActiveAutomations)
const activeRuns = new Set<Promise<unknown>>()

// Bildirim nesneleri çöp toplayıcıya gitmesin (yoksa tıklama olayı kaybolabilir)
const visibleNotifications = new Set<Notification>()

function showAutomationResult(automation: Automation, run: AutomationRun): void {
  const base = run.status === 'error' ? `Hata: ${run.summary}` : run.summary || 'Tamamlandı.'
  const body =
    run.skippedTools.length > 0
      ? `${base} (${run.skippedTools.length} adım izin yetersizliğinden atlandı)`
      : base
  const notification = new Notification({ title: automation.name, body, icon })
  visibleNotifications.add(notification)
  const release = (): void => {
    visibleNotifications.delete(notification)
  }
  notification.on('click', () => {
    release()
    showMainWindow()
    sendCommand('open-automations')
  })
  notification.on('close', release)
  notification.show()
  notifyPulse()
}

/**
 * Bir rutini hemen çalıştırır: çalıştırma kaydı açılır, talimat asistana verilir, sonuç
 * kaydedilir ve bildirim gösterilir. Hem zamanlayıcı hem de "şimdi çalıştır" arayüz eylemi bunu
 * kullanır.
 */
export function executeAutomation(automation: Automation): Promise<AutomationRun> {
  const run = runAutomation(automation)
  activeRuns.add(run)
  run.finally(() => activeRuns.delete(run)).catch(() => {})
  return run
}

async function runAutomation(automation: Automation): Promise<AutomationRun> {
  if (runningAutomationIds.has(automation.id)) {
    throw new Error(`"${automation.name}" zaten çalışıyor, bitmesini bekle.`)
  }
  runningAutomationIds.add(automation.id)

  const startedAt = Date.now()
  const runId = recordAutomationRunStart(automation.id, startedAt)

  let status: 'done' | 'error' = 'done'
  let summary = ''
  let skippedTools: AutomationRun['skippedTools'] = []
  try {
    // Negatif kimlik: gerçek bir sohbetle karışmayan, izlenebilir bir etkinlik kaydı sentetik kimliği
    const result = await runAutomationTurn(automation.prompt, automation.allowance, -automation.id)
    summary = result.text
    skippedTools = result.skipped
    // Model hiç araç çağırmadan sadece bir plan/açıklama yazdıysa iş aslında yapılmamıştır;
    // özeti başarılı gibi göstermek yanıltıcı olur, bunu en başa açıkça ekleriz.
    if (!result.usedTools) {
      summary = summary
        ? `⚠ Hiçbir araç çalıştırmadı, sadece yazdı: ${summary}`
        : '⚠ Hiçbir araç çalıştırmadı.'
    }
  } catch (err) {
    status = 'error'
    summary = err instanceof Error ? err.message : String(err)
  } finally {
    runningAutomationIds.delete(automation.id)
  }

  const finishedAt = Date.now()
  finishAutomationRun(runId, { status, summary, skippedTools }, finishedAt)
  notifyDataChanged('automations')

  const run: AutomationRun = {
    id: runId,
    automationId: automation.id,
    startedAt,
    finishedAt,
    status,
    summary,
    skippedTools
  }
  try {
    showAutomationResult(automation, run)
  } catch (err) {
    console.error('Otomasyon bildirimi gösterilemedi:', err)
  }
  return run
}

async function checkAutomations(): Promise<void> {
  const due = takeDueAutomations(Date.now())
  if (due.length === 0) return
  notifyDataChanged('automations')
  // Sırayla çalıştırılır: aynı anda birden fazla istek yerel modeli tıkatmasın
  for (const automation of due) {
    await executeAutomation(automation)
  }
}

/**
 * Zamanı gelen rutinleri düzenli aralıklarla kontrol edip çalıştırır. Bir tur bitmeden yenisi
 * başlamaz (model çağrısı 30 saniyeden uzun sürebilir). Durdurmak için dönen fonksiyon çağrılır.
 */
/** Şu an kaç otomasyon çalışıyor (kapanış günlüğü/hata ayıklama için) */
export function getActiveAutomationCount(): number {
  return activeRuns.size
}

/**
 * Uygulama kapanırken devam eden otomasyon çalıştırmalarının bitmesini bekler; sonsuza kadar
 * beklemez, `maxWaitMs` dolunca (model takılmış olabilir) pes edip döner. `closeDb()` çağrılmadan
 * önce kullanılmalı, yoksa yarım kalan bir çalıştırma kapanmış veritabanına yazmaya çalışır.
 */
export async function waitForActiveAutomations(maxWaitMs: number): Promise<void> {
  if (activeRuns.size === 0) return
  console.log(`${activeRuns.size} otomasyon çalışıyor, kapanmadan önce bitmesi bekleniyor...`)
  const allSettled = Promise.allSettled([...activeRuns])
  await Promise.race([allSettled, new Promise((resolve) => setTimeout(resolve, maxWaitMs))])
  if (activeRuns.size > 0) {
    console.warn(`${activeRuns.size} otomasyon zamanında bitmedi, uygulama yine de kapanıyor.`)
  }
}

export function startAutomationScheduler(): () => void {
  let running = false
  const tick = (): void => {
    if (running) return
    running = true
    checkAutomations()
      .catch((err) => console.error('Otomasyon kontrolü başarısız:', err))
      .finally(() => {
        running = false
      })
  }

  tick()
  const timer = setInterval(tick, CHECK_INTERVAL_MS)
  return () => clearInterval(timer)
}
