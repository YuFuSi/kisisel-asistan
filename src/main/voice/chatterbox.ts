import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Model ilk açılışta yüklenir (ilk kez internetten iner): bu kadar beklenir
const START_TIMEOUT_MS = 180_000
// Bir cümle için en uzun bekleme
const REQUEST_TIMEOUT_MS = 60_000
// Bu kadar süre ses istenmezse sunucu kapanır, ekran kartı belleği Qwen'e kalır
const IDLE_MS = 10 * 60_000
const MAX_TEXT = 1000
// Kullanıcının seçtiği neşeli ses ayarı
const EXAGGERATION = 0.85
const CFG = 0.35

/** Kullanıcının bilgisayarındaki Chatterbox Python ortamı (Ayarlar'da "Canlı ses") */
export function chatterboxPython(): string | null {
  const python = join(homedir(), '.jarvis-tts', '.venv', 'Scripts', 'python.exe')
  return existsSync(python) ? python : null
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() =>
        typeof address === 'object' && address ? resolve(address.port) : reject(new Error('port'))
      )
    })
  })
}

/**
 * Chatterbox Multilingual ile Türkçe, neşeli ses üretir. Python sunucusu sadece gerektiğinde
 * başlatılır ve 10 dk kullanılmazsa kapatılır (Qwen ile aynı anda ekran kartına sığmıyor).
 * Bu dosya electron import etmez.
 */
export class ChatterboxVoice {
  private child: ChildProcess | null = null
  private port = 0
  private starting: Promise<void> | null = null
  private idleTimer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private readonly python: string,
    private readonly script: string,
    // Başlamadan önce ekran kartında yer açar (Qwen'i bellekten çıkarır). Sonra yüklenen model
    // taşan kısmı yavaş belleğe koyar: ses taşarsa çok yavaşlıyor, Qwen taşarsa sadece %25.
    private readonly makeRoom: () => Promise<void> = async () => {}
  ) {}

  private start(): Promise<void> {
    if (this.starting) return this.starting
    this.starting = (async () => {
      await this.makeRoom().catch((err) => console.warn('Ekran kartında yer açılamadı:', err))
      this.port = await freePort()
      const child = spawn(this.python, ['-u', this.script, String(this.port)], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      })
      this.child = child
      let stderr = ''
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr = (stderr + chunk.toString()).slice(-2000)
      })
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Canlı ses zamanında yüklenemedi'))
        }, START_TIMEOUT_MS)
        child.stdout?.on('data', (chunk: Buffer) => {
          if (chunk.toString().includes('READY')) {
            clearTimeout(timer)
            resolve()
          }
        })
        child.on('exit', (code) => {
          clearTimeout(timer)
          reject(new Error(`Canlı ses sunucusu kapandı (${code}): ${stderr.trim().slice(-300)}`))
        })
      })
      child.on('exit', () => {
        if (this.child === child) this.reset()
      })
    })()
    this.starting.catch(() => this.stop())
    return this.starting
  }

  private reset(): void {
    clearTimeout(this.idleTimer)
    this.child = null
    this.starting = null
  }

  private touch(): void {
    clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => {
      console.info('Canlı ses 10 dk kullanılmadı, kapatılıyor')
      this.stop()
    }, IDLE_MS)
  }

  /** Sesli sohbet başlarken modeli önceden yükler (ilk cümle beklemesin) */
  warmUp(): void {
    this.touch()
    this.start().catch((err) => console.error('Canlı ses başlatılamadı:', err))
  }

  async synthesize(text: string): Promise<ArrayBuffer> {
    this.touch()
    await this.start()
    const response = await fetch(`http://127.0.0.1:${this.port}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, MAX_TEXT), exaggeration: EXAGGERATION, cfg: CFG }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (!response.ok) throw new Error(`Canlı ses üretemedi: ${await response.text()}`)
    this.touch()
    return response.arrayBuffer()
  }

  stop(): void {
    const child = this.child
    this.reset()
    if (!child) return
    // stdin kapanınca sunucu kendisi çıkar; çıkmazsa zorla kapatılır
    child.stdin?.end()
    setTimeout(() => {
      if (child.exitCode === null) child.kill()
    }, 2000).unref()
  }
}
