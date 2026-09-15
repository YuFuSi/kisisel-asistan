import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  PIPER_VOICE_FILE,
  VOICE_PACK,
  WHISPER_MODEL_FILE,
  findFile,
  isInstalled,
  resolveVoicePaths
} from './pack'

let root: string

const touch = (path: string): void => {
  mkdirSync(join(root, path, '..'), { recursive: true })
  writeFileSync(join(root, path), 'x')
}
const item = (id: string): (typeof VOICE_PACK)[number] =>
  VOICE_PACK.find((entry) => entry.id === id)!

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jarvis-ses-'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('ses paketi', () => {
  it('boş klasörde hiçbir parça kurulu değil', () => {
    for (const entry of VOICE_PACK) expect(isInstalled(root, entry), entry.id).toBe(false)
    expect(resolveVoicePaths(root)).toEqual({
      whisperServer: null,
      whisperModel: null,
      piper: null,
      piperVoice: null,
      wakeword: null
    })
  })

  it('zipten açılan programı alt klasörlerde bulur', () => {
    touch('whisper/Release/whisper-server.exe')
    touch('piper/piper/piper.exe')
    expect(isInstalled(root, item('whisper'))).toBe(true)
    expect(isInstalled(root, item('piper'))).toBe(true)
    expect(findFile(join(root, 'piper'), 'piper.exe')).toBe(
      join(root, 'piper', 'piper', 'piper.exe')
    )
  })

  it('çok dosyalı parça ancak tüm dosyaları varsa kurulu sayılır', () => {
    touch(PIPER_VOICE_FILE)
    expect(isInstalled(root, item('piperVoice'))).toBe(false)
    expect(resolveVoicePaths(root).piperVoice).toBeNull()
    touch(`${PIPER_VOICE_FILE}.json`)
    expect(isInstalled(root, item('piperVoice'))).toBe(true)

    touch('wakeword/hey_jarvis_v0.1.onnx')
    touch('wakeword/melspectrogram.onnx')
    expect(resolveVoicePaths(root).wakeword).toBeNull()
    touch('wakeword/embedding_model.onnx')
    touch(WHISPER_MODEL_FILE)
    const paths = resolveVoicePaths(root)
    expect(paths.wakeword?.model).toBe(join(root, 'wakeword', 'hey_jarvis_v0.1.onnx'))
    expect(paths.whisperModel).toBe(join(root, WHISPER_MODEL_FILE))
  })

  it('boş dosyayı kurulu saymaz', () => {
    mkdirSync(join(root, 'models'), { recursive: true })
    writeFileSync(join(root, WHISPER_MODEL_FILE), '')
    expect(isInstalled(root, item('whisperModel'))).toBe(false)
  })
})
