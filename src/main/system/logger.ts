import { app, shell } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import log from 'electron-log/main'

// Dosya bu boyutu geçince main.old.log olarak saklanır ve yeni dosya başlar
const MAX_LOG_BYTES = 2 * 1024 * 1024

export function logDirectory(): string {
  return join(app.getPath('userData'), 'logs')
}

/**
 * Uyarı ve hataları %APPDATA%\kisisel-asistan\logs\main.log dosyasına yazar.
 * Mevcut console.log/warn/error çağrıları da dosyaya gider (terminalde görünmeye devam eder).
 * Veri klasörü ayarlandıktan sonra, her şeyden önce çağrılır.
 */
export function initLogging(): void {
  log.transports.file.resolvePathFn = () => join(logDirectory(), 'main.log')
  log.transports.file.maxSize = MAX_LOG_BYTES
  Object.assign(console, log.functions)
  // Yakalanmayan hatalar da dosyaya yazılsın; Electron'un hata penceresi yerine günlük yeterli
  log.errorHandler.startCatching({ showDialog: false })
  log.info(`Jarvis başladı (sürüm ${app.getVersion()}${app.isPackaged ? '' : ', geliştirme modu'})`)
}

/** Arayüzden gelen hata mesajı */
export function logRendererError(message: string): void {
  log.error('[arayüz]', String(message).slice(0, 4000))
}

export async function openLogDirectory(): Promise<void> {
  const dir = logDirectory()
  mkdirSync(dir, { recursive: true })
  const error = await shell.openPath(dir)
  if (error) throw new Error(`Günlük klasörü açılamadı: ${error}`)
}
