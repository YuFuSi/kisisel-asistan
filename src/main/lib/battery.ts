// Pil azaldı uyarısı için sabit eşik. Windows'un kendi uyarılarıyla benzer aralıkta.
const LOW_BATTERY_PERCENT = 20

export interface BatteryReading {
  hasBattery: boolean
  /**
   * Şarj kablosu takılı mı. "isCharging" yerine bunu kullanıyoruz: pil tam doluyken
   * veya ağır yük altında kablo takılıyken bile "isCharging" false olabiliyor,
   * ama kullanıcıyı "şarja tak" diye uyarmanın bir anlamı kalmıyor.
   */
  acConnected: boolean
  percent: number
}

/**
 * Pil azaldı uyarısı gösterilmeli mi: pil var, kablo takılı değil, eşiğin altında ve
 * bu "düşük pil bölümü" için henüz uyarılmadıysa evet. Kablo takılınca veya
 * pil yeterince dolunca bayrak sıfırlanır, bir sonraki düşüşte tekrar uyarılabilir.
 */
export function shouldWarnLowBattery(reading: BatteryReading, alreadyWarned: boolean): boolean {
  if (!reading.hasBattery || reading.acConnected) return false
  if (reading.percent > LOW_BATTERY_PERCENT) return false
  return !alreadyWarned
}

/** Uyarı bayrağının sıfırlanması gerekiyor mu: kablo takıldı veya pil yeterince doldu */
export function shouldResetLowBatteryWarning(reading: BatteryReading): boolean {
  return reading.acConnected || reading.percent > LOW_BATTERY_PERCENT
}
