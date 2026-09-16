import { Notification } from 'electron'
import si from 'systeminformation'
import icon from '../../../resources/icon.png?asset'
import {
  shouldResetLowBatteryWarning,
  shouldWarnLowBattery,
  type BatteryReading
} from '../lib/battery'

// Otomasyon motorunun ikinci hazır senaryosu: zamana değil pil durumuna bağlı bir tetikleyici.
// Sabah özetinden farklı olarak "günde bir kez" değil, "düşük pil bölümü başına bir kez" mantığı var:
// şarja takılınca veya pil dolunca sıfırlanır, bir sonraki düşüşte tekrar uyarabilir.
const CHECK_INTERVAL_MS = 60_000
let warned = false

async function readBattery(): Promise<BatteryReading | null> {
  try {
    const battery = await si.battery()
    return {
      hasBattery: battery.hasBattery,
      acConnected: battery.acConnected,
      percent: battery.percent
    }
  } catch (err) {
    console.error('Pil durumu okunamadı:', err)
    return null
  }
}

async function check(): Promise<void> {
  const reading = await readBattery()
  if (!reading) return

  if (shouldResetLowBatteryWarning(reading)) {
    warned = false
    return
  }

  if (shouldWarnLowBattery(reading, warned)) {
    warned = true
    new Notification({
      title: 'Pil azaldı',
      body: `Pil %${Math.round(reading.percent)} kaldı. Şarja takmayı unutma.`,
      icon
    }).show()
  }
}

/** Her dakika pil seviyesine bakar; düşük pil bölümü başına en fazla bir kez bildirir. */
export function startBatteryScheduler(): () => void {
  void check()
  const timer = setInterval(() => void check(), CHECK_INTERVAL_MS)
  return () => clearInterval(timer)
}
