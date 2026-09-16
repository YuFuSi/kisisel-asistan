import { Notification } from 'electron'
import icon from '../../../resources/icon.png?asset'
import { collectDailyBrief } from '../ai/brief'
import { briefNotificationText, briefSpokenText, isBriefDue } from '../lib/brief'
import { toLocalDate } from '../lib/datetime'
import { getSettings, getStoredValue, setStoredValue } from '../settings'
import { sendCommand, showMainWindow } from '../system/window'
import { speakWithVoice } from '../voice/session'

const CHECK_INTERVAL_MS = 60_000
const LAST_SHOWN_KEY = 'briefLastShown'

// Bildirim nesnesi çöp toplayıcıya gitmesin (yoksa tıklama olayı kaybolabilir)
let visibleNotification: Notification | null = null
let collecting = false

/** Sabah özetini toplayıp bildirim olarak gösterir. Tıklanınca sohbette ayrıntılı özet istenir. */
export async function showDailyBrief(): Promise<void> {
  const brief = await collectDailyBrief()
  const notification = new Notification({
    title: `Günaydın! ${brief.tarih}`,
    body: briefNotificationText({
      tasks: brief.gorevler.length,
      events: brief.etkinlikler?.length ?? null,
      unreadMails: brief.okunmamisEposta,
      temperature: brief.hava?.sicaklik ?? null
    }),
    icon
  })
  visibleNotification = notification
  notification.on('click', () => {
    visibleNotification = null
    showMainWindow()
    sendCommand('daily-brief')
  })
  notification.on('close', () => {
    if (visibleNotification === notification) visibleNotification = null
  })
  notification.show()

  // Jarvis'in ilk gerçek otomasyonu: zamanı gelince kendiliğinden konuşur, tıklama beklemez
  if (getSettings().briefSpoken) {
    try {
      speakWithVoice(briefSpokenText(brief))
    } catch (err) {
      console.error('Sabah özeti sesli okunamadı:', err)
    }
  }
}

/** Her dakika sabah özeti saatinin gelip gelmediğine bakar. Durdurmak için dönen fonksiyon çağrılır. */
export function startBriefScheduler(): () => void {
  const check = async (): Promise<void> => {
    if (collecting) return
    const settings = getSettings()
    const now = new Date()
    if (!settings.briefEnabled) return
    if (!isBriefDue(now, settings.briefTime, getStoredValue(LAST_SHOWN_KEY) ?? null)) return

    collecting = true
    // Önce işaretlenir: veri toplama hata verse de aynı gün tekrar tekrar denenmesin
    setStoredValue(LAST_SHOWN_KEY, toLocalDate(now))
    try {
      await showDailyBrief()
    } catch (err) {
      console.error('Sabah özeti gösterilemedi:', err)
    } finally {
      collecting = false
    }
  }

  void check()
  const timer = setInterval(() => void check(), CHECK_INTERVAL_MS)
  return () => clearInterval(timer)
}
