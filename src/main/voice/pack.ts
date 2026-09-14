import { execFile } from 'node:child_process'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import type { VoicePackComponent } from '../../shared/api'

// Yerel ses paketi: internetsiz yazıya çevirme (whisper.cpp), Türkçe ses (Piper) ve "hey jarvis" modeli.
// Bu dosya electron import etmez; paketin kurulacağı klasör dışarıdan verilir.

const execFileAsync = promisify(execFile)

export interface PackFile {
  url: string
  /** Paket klasörüne göre yol */
  path: string
}

export interface PackItem {
  id: VoicePackComponent
  label: string
  sizeMb: number
  files: PackFile[]
  /** Verilirse indirilen zip bu klasöre açılır ve silinir */
  extractTo?: string
  /** Kurulu olduğunu gösteren dosya: yol veya (klasörde aranacak) dosya adı */
  marker: string
}

const WHISPER_RELEASE = 'https://github.com/ggml-org/whisper.cpp/releases/download/b5130'
const PIPER_RELEASE = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2'
const PIPER_VOICE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/tr/tr_TR/dfki/medium'
const WAKEWORD_RELEASE = 'https://github.com/dscripka/openWakeWord/releases/download/v0.5.1'

export const WHISPER_MODEL_FILE = 'models/ggml-large-v3-turbo-q5_0.bin'
export const PIPER_VOICE_FILE = 'voices/tr_TR-dfki-medium.onnx'

export const VOICE_PACK: PackItem[] = [
  {
    id: 'wakeword',
    label: '"Hey Jarvis" uyandırma modeli',
    sizeMb: 4,
    files: ['hey_jarvis_v0.1.onnx', 'melspectrogram.onnx', 'embedding_model.onnx'].map((name) => ({
      url: `${WAKEWORD_RELEASE}/${name}`,
      path: `wakeword/${name}`
    })),
    marker: 'wakeword/hey_jarvis_v0.1.onnx'
  },
  {
    id: 'piper',
    label: 'Ses üretme programı (Piper)',
    sizeMb: 21,
    files: [{ url: `${PIPER_RELEASE}/piper_windows_amd64.zip`, path: 'downloads/piper.zip' }],
    extractTo: 'piper',
    marker: 'piper.exe'
  },
  {
    id: 'piperVoice',
    label: 'Türkçe ses (dfki)',
    sizeMb: 60,
    files: [
      { url: `${PIPER_VOICE}/tr_TR-dfki-medium.onnx`, path: PIPER_VOICE_FILE },
      { url: `${PIPER_VOICE}/tr_TR-dfki-medium.onnx.json`, path: `${PIPER_VOICE_FILE}.json` }
    ],
    marker: PIPER_VOICE_FILE
  },
  {
    id: 'whisper',
    label: 'Konuşma tanıma programı (whisper.cpp)',
    sizeMb: 8,
    files: [{ url: `${WHISPER_RELEASE}/whisper-bin-x64.zip`, path: 'downloads/whisper.zip' }],
    extractTo: 'whisper',
    marker: 'whisper-server.exe'
  },
  {
    id: 'whisperModel',
    label: 'Konuşma tanıma modeli (large-v3-turbo)',
    sizeMb: 547,
    files: [
      {
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin',
        path: WHISPER_MODEL_FILE
      }
    ],
    marker: WHISPER_MODEL_FILE
  }
]

/** Klasörde (alt klasörler dahil) verilen addaki ilk dosya */
export function findFile(dir: string, name: string, depth = 4): string | null {
  if (!existsSync(dir) || depth < 0) return null
  const entries = readdirSync(dir, { withFileTypes: true })
  const direct = entries.find((entry) => entry.isFile() && entry.name.toLowerCase() === name)
  if (direct) return join(dir, direct.name)
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const found = findFile(join(dir, entry.name), name, depth - 1)
    if (found) return found
  }
  return null
}

const fileExists = (path: string): boolean => existsSync(path) && statSync(path).size > 0

export function isInstalled(root: string, item: PackItem): boolean {
  if (item.extractTo)
    return findFile(join(root, item.extractTo), item.marker.toLowerCase()) !== null
  return item.files.every((file) => fileExists(join(root, file.path)))
}

export interface VoicePaths {
  whisperServer: string | null
  whisperModel: string | null
  piper: string | null
  piperVoice: string | null
  wakeword: { melspectrogram: string; embedding: string; model: string } | null
}

/** Kurulu parçaların dosya yolları; eksik parça null */
export function resolveVoicePaths(root: string): VoicePaths {
  const wake = (name: string): string => join(root, 'wakeword', name)
  const wakewordReady = [
    'hey_jarvis_v0.1.onnx',
    'melspectrogram.onnx',
    'embedding_model.onnx'
  ].every((name) => fileExists(wake(name)))
  const optional = (path: string): string | null => (fileExists(path) ? path : null)
  return {
    whisperServer: findFile(join(root, 'whisper'), 'whisper-server.exe'),
    whisperModel: optional(join(root, WHISPER_MODEL_FILE)),
    piper: findFile(join(root, 'piper'), 'piper.exe'),
    piperVoice:
      fileExists(join(root, PIPER_VOICE_FILE)) && fileExists(join(root, `${PIPER_VOICE_FILE}.json`))
        ? join(root, PIPER_VOICE_FILE)
        : null,
    wakeword: wakewordReady
      ? {
          melspectrogram: wake('melspectrogram.onnx'),
          embedding: wake('embedding_model.onnx'),
          model: wake('hey_jarvis_v0.1.onnx')
        }
      : null
  }
}

export type ProgressListener = (received: number, total: number) => void

// Bu süre boyunca hiç veri gelmezse indirme iptal edilir
const IDLE_TIMEOUT_MS = 60_000

/** Dosyayı önce .part olarak indirir, tamamlanınca adını değiştirir (yarım dosya kurulu sayılmasın) */
export async function downloadFile(
  url: string,
  destination: string,
  onProgress: ProgressListener
): Promise<void> {
  mkdirSync(dirname(destination), { recursive: true })
  const partial = `${destination}.part`
  const controller = new AbortController()
  let idle = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    if (!response.ok || !response.body) {
      throw new Error(`İndirme başarısız (HTTP ${response.status}): ${url}`)
    }
    const total = Number(response.headers.get('content-length') ?? 0)
    let received = 0
    const body = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream)
    body.on('data', (chunk: Buffer) => {
      received += chunk.length
      clearTimeout(idle)
      idle = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS)
      onProgress(received, total)
    })
    await pipeline(body, createWriteStream(partial))
    if (total > 0 && received !== total) throw new Error('İndirme yarıda kaldı, tekrar dene.')
    renameSync(partial, destination)
  } catch (err) {
    rmSync(partial, { force: true })
    if (controller.signal.aborted) throw new Error('İndirme uzun süre ilerlemedi ve durduruldu.')
    throw err
  } finally {
    clearTimeout(idle)
  }
}

/** Windows'un kendi tar.exe'si ile zip açar (sabit komut, argümanlar sadece dosya yolları) */
export async function extractZip(zipPath: string, targetDir: string): Promise<void> {
  mkdirSync(targetDir, { recursive: true })
  const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
  await execFileAsync(tar, ['-xf', zipPath, '-C', targetDir], { windowsHide: true })
}

export async function installItem(
  root: string,
  item: PackItem,
  onProgress: ProgressListener
): Promise<void> {
  const totals = new Map<string, { received: number; total: number }>()
  const report = (): void => {
    let received = 0
    let total = 0
    for (const entry of totals.values()) {
      received += entry.received
      total += entry.total
    }
    onProgress(received, total || item.sizeMb * 1024 * 1024)
  }

  for (const file of item.files) {
    const destination = join(root, file.path)
    if (!item.extractTo && fileExists(destination)) continue
    await downloadFile(file.url, destination, (received, total) => {
      totals.set(file.path, { received, total })
      report()
    })
    if (item.extractTo) {
      await extractZip(destination, join(root, item.extractTo))
      rmSync(destination, { force: true })
    }
  }
  if (!isInstalled(root, item)) {
    throw new Error(`${item.label} kuruldu ama beklenen dosya bulunamadı.`)
  }
}
