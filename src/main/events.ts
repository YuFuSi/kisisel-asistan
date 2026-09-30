import { BrowserWindow, type WebContents } from 'electron'
import type { ChatEvent, DataScope } from '../shared/api'

// Veri değişince açık tüm pencerelere haber ver; Görevler/Notlar sayfaları kendini yeniler.
// (Ör. asistan sohbette görev eklediğinde Görevler sayfası anında güncellenir.)
export function notifyDataChanged(scope: DataScope): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed()) window.webContents.send('data:changed', scope)
  }
}

// Sohbet olayı (cevap parçası, araç, onay, bitiş) isteği yapan pencereye gider; aynı olay
// yardımcı pencerelere (çentik, HUD) de kopyalanır ki hepsi aynı durumu göstersin. Sohbet listesi
// sadece ana pencerede olduğu için diğerleri olayları yalnızca küre ve kartlar için kullanır.
export function sendChatEvent(sender: WebContents, event: ChatEvent): void {
  if (!sender.isDestroyed()) sender.send('chat:event', event)
  // Testlerde (Electron dışında) pencere listesi yoktur
  if (typeof BrowserWindow?.getAllWindows !== 'function') return
  for (const window of BrowserWindow.getAllWindows()) {
    const contents = window.webContents
    if (contents !== sender && !contents.isDestroyed()) contents.send('chat:event', event)
  }
}
