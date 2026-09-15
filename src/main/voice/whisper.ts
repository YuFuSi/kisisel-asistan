import { spawn, type ChildProcess } from 'node:child_process'
import { createServer, type AddressInfo } from 'node:net'
import { availableParallelism } from 'node:os'
import { dirname } from 'node:path'

// Model belleğe yüklenirken beklenecek en uzun süre
const START_TIMEOUT_MS = 90_000
const REQUEST_TIMEOUT_MS = 60_000
// Bu süre kullanılmazsa program kapatılıp bellek (~1 GB) boşaltılır; sonraki konuşmada yeniden açılır
const IDLE_STOP_MS = 10 * 60_000

/** İşletim sisteminden boş bir port ister */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      server.close(() => resolve(port))
    })
  })
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// Whisper her seferinde 30 sn'lik pencere (1500 kare, kare başına 20 ms) işler. Kısa seste pencereyi
// sesin uzunluğuna indirmek çevirmeyi ~2,5 kat hızlandırıyor (ölçüm: 512 karede 3,2 sn, sonuç aynı).
const MIN_AUDIO_CTX = 512
const MAX_AUDIO_CTX = 1500

/** 16 kHz, 16 bit tek kanallı WAV'ın süresine yetecek pencere boyu */
export function audioContextFor(wav: ArrayBuffer): number {
  const seconds = Math.max(0, wav.byteLength - 44) / (16000 * 2)
  return Math.min(MAX_AUDIO_CTX, Math.max(MIN_AUDIO_CTX, Math.ceil(seconds * 50) + 64))
}

/**
 * whisper.cpp sunucusu: konuşmayı internetsiz yazıya çevirir. İlk istekte başlatılır, sadece
 * 127.0.0.1'den dinler. Çalıştırılan komut ve argümanlar sabittir. Bu dosya electron import etmez.
 */
export class WhisperServer {
  private child: ChildProcess | null = null
  private ready: Promise<string> | null = null
  private idleTimer: ReturnType<typeof setTimeout> | undefined
  private log = ''

  constructor(
    private readonly exe: string,
    private readonly model: string
  ) {}

  /** Programı başlatır ve model yüklenene kadar bekler; adresini döndürür */
  start(): Promise<string> {
    if (!this.ready) {
      this.ready = this.launch().catch((err: unknown) => {
        this.stop()
        throw err
      })
      this.touch()
    }
    return this.ready
  }

  private async launch(): Promise<string> {
    const port = await freePort()
    // Ölçüm (i9-14900HX): 8 iş parçacığı 8,2 sn, 16 iş parçacığı 6,5 sn (3 sn'lik cümle, tam pencere)
    const threads = Math.max(4, Math.min(16, availableParallelism() - 4))
    const child = spawn(
      this.exe,
      [
        '-m',
        this.model,
        '-l',
        'tr',
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '-t',
        String(threads)
      ],
      { cwd: dirname(this.exe), windowsHide: true }
    )
    this.child = child
    this.log = ''
    const collect = (chunk: Buffer): void => {
      this.log = (this.log + chunk.toString()).slice(-2000)
    }
    child.stdout?.on('data', collect)
    child.stderr?.on('data', collect)

    const exited = new Promise<never>((_, reject) => {
      child.once('error', (err) =>
        reject(new Error(`Konuşma tanıma programı başlatılamadı: ${err.message}`))
      )
      child.once('exit', (code) => {
        if (this.child === child) {
          this.child = null
          this.ready = null
        }
        reject(new Error(`Konuşma tanıma programı kapandı (kod ${code}). ${this.log.slice(-300)}`))
      })
    })
    // Program sonradan kapanırsa bu söz yakalanmamış hata olarak kalmasın
    exited.catch(() => {})

    const base = `http://127.0.0.1:${port}`
    const waitReady = async (): Promise<string> => {
      const deadline = Date.now() + START_TIMEOUT_MS
      while (Date.now() < deadline) {
        try {
          const response = await fetch(`${base}/`, { signal: AbortSignal.timeout(1000) })
          if (response.status < 500) return base
        } catch {
          // Henüz dinlemiyor
        }
        await delay(300)
      }
      throw new Error('Konuşma tanıma programı zamanında hazır olmadı.')
    }
    return Promise.race([waitReady(), exited])
  }

  /** 16 kHz WAV sesini yazıya çevirir (temizlenmemiş ham metin) */
  async transcribe(wav: ArrayBuffer): Promise<string> {
    const base = await this.start()
    this.touch()
    const form = new FormData()
    form.append('file', new Blob([wav], { type: 'audio/wav' }), 'ses.wav')
    form.append('response_format', 'json')
    form.append('temperature', '0.0')
    form.append('language', 'tr')
    form.append('audio_ctx', String(audioContextFor(wav)))

    let response: Response
    try {
      response = await fetch(`${base}/inference`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      })
    } catch {
      throw new Error('Konuşma tanıma programına ulaşılamadı, tekrar dene.')
    } finally {
      this.touch()
    }
    if (!response.ok) throw new Error(`Konuşma yazıya çevrilemedi (HTTP ${response.status}).`)
    const data = (await response.json()) as { text?: string; error?: string }
    if (data.error) throw new Error(`Konuşma yazıya çevrilemedi: ${data.error}`)
    return data.text ?? ''
  }

  private touch(): void {
    clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => this.stop(), IDLE_STOP_MS)
    this.idleTimer.unref?.()
  }

  stop(): void {
    clearTimeout(this.idleTimer)
    const child = this.child
    this.child = null
    this.ready = null
    child?.kill()
  }
}
