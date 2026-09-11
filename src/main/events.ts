import { BrowserWindow } from 'electron'
import type { DataScope } from '../shared/api'

// Veri değişince açık tüm pencerelere haber ver; Görevler/Notlar sayfaları kendini yeniler.
// (Ör. asistan sohbette görev eklediğinde Görevler sayfası anında güncellenir.)
export function notifyDataChanged(scope: DataScope): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed()) window.webContents.send('data:changed', scope)
  }
}
