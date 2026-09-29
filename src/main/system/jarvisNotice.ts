import { Notification } from 'electron'
import icon from '../../../resources/icon.png?asset'
import { isQuietTime } from '../lib/quietHours'
import { getSettings } from '../settings'
import { speakWithVoice } from '../voice/session'
import { notifyPulse, showMainWindow } from './window'

// Tek ses: hatırlatma, proaktif uyarı, pil ve rutin bildirimleri aynı yoldan geçer. Windows
// bildirimi gösterilir, küre (ana pencere ve HUD) nabız atar; ayar açıksa ve sessiz saat değilse
// Jarvis uyarıyı sesli de söyler.

export interface JarvisNotice {
  title: string
  body: string
  /** Sesli söylenecek metin; verilmezse "başlık. metin" */
  spoken?: string
  /** Sadece yazılı (ör. açılışta toplu gelen kaçırılan hatırlatmalar birbirini kesmesin) */
  silent?: boolean
  /** Bildirime tıklanınca (ana pencere zaten öne getirilir) */
  onClick?: () => void
}

// Bildirim nesneleri çöp toplayıcıya gitmesin (yoksa tıklama olayı kaybolabilir)
const visible = new Set<Notification>()

/** Şu an uyarılar sesli söylenmeli mi (ayar + sessiz saatler) */
export function shouldSpeakNotices(now = new Date()): boolean {
  const { noticesSpoken, quietStart, quietEnd } = getSettings()
  return noticesSpoken && !isQuietTime(now, quietStart, quietEnd)
}

export function showJarvisNotice(notice: JarvisNotice): void {
  const notification = new Notification({ title: notice.title, body: notice.body, icon })
  visible.add(notification)
  notification.on('click', () => {
    visible.delete(notification)
    showMainWindow()
    notice.onClick?.()
  })
  notification.on('close', () => visible.delete(notification))
  notification.show()
  notifyPulse()

  if (notice.silent || !shouldSpeakNotices()) return
  try {
    // Sesli sohbet sürerken speakWithVoice araya girmez; o zaman sadece yazılı kalır
    speakWithVoice(notice.spoken ?? `${notice.title}. ${notice.body}`)
  } catch (err) {
    console.error('Uyarı sesli söylenemedi:', err)
  }
}
