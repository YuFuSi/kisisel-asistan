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
export async function executeAutomation(automation: Automation): Promise<AutomationRun> {
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
  } catch (err) {
    status = 'error'
    summary = err instanceof Error ? err.message : String(err)
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
