import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

// Bir cümlenin seslendirilmesi için beklenecek en uzun süre (ilk cümlede model de yüklenir)
const TIMEOUT_MS = 30_000
const MAX_TEXT = 1000

interface Pending {
  resolve: () => void
  reject: (error: Error) => void
}

/**
 * Piper ile Türkçe ses üretir. Program sürekli açık tutulur (--json-input): model bir kez yüklenir,
 * sonraki cümleler ~200 ms'de hazır olur. Her satır bir istek, program bitince dosya yolunu yazar.
 * Bu dosya electron import etmez.
 */
export class PiperVoice {
  private child: ChildProcessWithoutNullStreams | null = null
  private pending: Pending | null = null
  private stdout = ''
  // İstekler sırayla işlenir; program aynı anda tek cümle üretir
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly exe: string,
    private readonly model: string,
    // Piper'ın üretim sırasında hızı ayarlayan parametresi: 1 = normal, düşük değer = daha hızlı.
    // Ayarlar'daki "konuşma hızı" çarpanının tersidir (1 / hız); playbackRate ile sonradan hızlandırmaktan
    // farklı olarak tona ve doğallığa dokunmaz çünkü modelin kendisi o hızda üretir.
    private lengthScale = 1
  ) {}

  /** Hız ayarı değiştiyse çalışan programı kapatır; bir sonraki cümle yeni hızla yeniden başlatır */
  setLengthScale(value: number): void {
    if (value === this.lengthScale) return
    this.lengthScale = value
    if (this.child) this.stop()
  }

  private ensureProcess(): ChildProcessWithoutNullStreams {
    if (this.child) return this.child
    const child = spawn(
      this.exe,
      [
        '--model',
        this.model,
        '--length_scale',
        String(this.lengthScale),
        '--json-input',
        '--quiet'
      ],
      { cwd: dirname(this.exe), windowsHide: true }
    )
    let stderr = ''
    const fail = (message: string): void => {
      if (this.child === child) this.child = null
      const pending = this.pending
      this.pending = null
      pending?.reject(new Error(message))
    }

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      this.stdout += chunk
      let index = this.stdout.indexOf('\n')
      while (index !== -1) {
        const line = this.stdout.slice(0, index).trim()
        this.stdout = this.stdout.slice(index + 1)
        if (line && this.pending) {
          const pending = this.pending
          this.pending = null
          pending.resolve()
        }
        index = this.stdout.indexOf('\n')
      }
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-1000)
    })
    // Program kapanmışken yazılırsa (EPIPE) hata 'exit' ile zaten bildirilir
    child.stdin.on('error', () => {})
    child.on('error', (err) => fail(`Ses programı başlatılamadı: ${err.message}`))
    child.on('exit', (code) => fail(`Ses programı kapandı (kod ${code}). ${stderr.slice(-300)}`))

    this.child = child
    this.stdout = ''
    return child
  }

  /** Metni seslendirir, 22050 Hz WAV dosyasının içeriğini döndürür */
  synthesize(text: string): Promise<ArrayBuffer> {
    const run = this.queue.then(() => this.runOne(text))
    this.queue = run.catch(() => {})
    return run
  }

  private async runOne(text: string): Promise<ArrayBuffer> {
    const content = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)
    if (!content) throw new Error('Seslendirilecek metin boş.')
    const output = join(tmpdir(), `jarvis-ses-${randomUUID()}.wav`)
    const child = this.ensureProcess()

    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending = null
          this.stop()
          reject(new Error('Ses üretimi zaman aşımına uğradı.'))
        }, TIMEOUT_MS)
        this.pending = {
          resolve: () => {
            clearTimeout(timer)
            resolve()
          },
          reject: (error) => {
            clearTimeout(timer)
            reject(error)
          }
        }
        child.stdin.write(`${JSON.stringify({ text: content, output_file: output })}\n`, 'utf8')
      })
      const data = await readFile(output)
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    } finally {
      await rm(output, { force: true })
    }
  }

  /** Modeli önceden belleğe yükler; ilk cevapta beklenmesin */
  warmUp(): void {
    this.synthesize('Merhaba.').catch(() => {})
  }

  stop(): void {
    const child = this.child
    this.child = null
    child?.stdin.end()
    child?.kill()
  }
}
