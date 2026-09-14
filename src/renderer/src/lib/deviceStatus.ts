import { useEffect, useState, useSyncExternalStore } from 'react'

/** Belirli aralıklarla yenilenen şu anki zaman (saat göstergesi, selamlama) */
export function useClock(intervalMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

/** İnternet bağlantısı var mı (işletim sisteminin bildirdiği ağ durumu) */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine)
}

export interface BatteryInfo {
  /** 0-1 */
  level: number
  charging: boolean
}

interface BatteryManagerLike extends EventTarget {
  level: number
  charging: boolean
}

/**
 * Pil durumu. Pili olmayan bilgisayarlar "tam dolu ve şarjda" bildirir; bu durumda gösterecek
 * bilgi olmadığı için null döner.
 */
export function useBattery(): BatteryInfo | null {
  const [info, setInfo] = useState<BatteryInfo | null>(null)
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> }
    if (!nav.getBattery) return
    let alive = true
    let battery: BatteryManagerLike | null = null
    const read = (): void => {
      if (!battery || !alive) return
      const full = battery.charging && battery.level >= 1
      setInfo(full ? null : { level: battery.level, charging: battery.charging })
    }
    nav.getBattery().then(
      (manager) => {
        battery = manager
        read()
        manager.addEventListener('levelchange', read)
        manager.addEventListener('chargingchange', read)
      },
      () => {}
    )
    return () => {
      alive = false
      battery?.removeEventListener('levelchange', read)
      battery?.removeEventListener('chargingchange', read)
    }
  }, [])
  return info
}

/** Bilgisayarda mikrofon var mı (izin istemeden, cihaz listesinden) */
export function useMicrophoneAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null)
  useEffect(() => {
    const devices = navigator.mediaDevices
    if (!devices) return
    let alive = true
    const check = (): void => {
      devices.enumerateDevices().then(
        (list) => {
          if (alive) setAvailable(list.some((device) => device.kind === 'audioinput'))
        },
        () => {
          if (alive) setAvailable(false)
        }
      )
    }
    check()
    devices.addEventListener('devicechange', check)
    return () => {
      alive = false
      devices.removeEventListener('devicechange', check)
    }
  }, [])
  return available
}
