import { voiceDirectory } from './engines'
import { VOICE_PACK, installItem, isInstalled } from './pack'
import { emitVoiceEvent, refreshVoiceSession } from './session'
import type { VoicePackComponent, VoicePackStatus } from '../../shared/api'

// İlerleme olayları arayüzü yormasın diye en fazla bu sıklıkta gönderilir
const PROGRESS_INTERVAL_MS = 250

let installing: VoicePackComponent | null = null
let received = 0
let total = 0
let lastError: string | null = null
let running: Promise<VoicePackStatus> | null = null

export function getVoicePackStatus(): VoicePackStatus {
  const root = voiceDirectory()
  const items = VOICE_PACK.map((item) => ({
    id: item.id,
    label: item.label,
    sizeMb: item.sizeMb,
    installed: isInstalled(root, item)
  }))
  return {
    items,
    installed: items.every((item) => item.installed),
    installing,
    received,
    total,
    error: lastError
  }
}

function emitStatus(): void {
  emitVoiceEvent({ type: 'pack', status: getVoicePackStatus() })
}

async function installMissing(): Promise<VoicePackStatus> {
  const root = voiceDirectory()
  lastError = null
  try {
    for (const item of VOICE_PACK) {
      if (isInstalled(root, item)) continue
      installing = item.id
      received = 0
      total = item.sizeMb * 1024 * 1024
      emitStatus()
      let lastEmit = 0
      await installItem(root, item, (bytes, size) => {
        received = bytes
        total = size
        const now = Date.now()
        if (now - lastEmit >= PROGRESS_INTERVAL_MS) {
          lastEmit = now
          emitStatus()
        }
      })
      console.info(`Ses paketi parçası kuruldu: ${item.label}`)
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err)
    console.error('Ses paketi kurulamadı:', err)
    throw err
  } finally {
    installing = null
    received = 0
    total = 0
    emitStatus()
    refreshVoiceSession()
  }
  return getVoicePackStatus()
}

/** Eksik parçaları sırayla indirir; aynı anda ikinci kez çağrılırsa süren kurulumu bekler */
export function installVoicePack(): Promise<VoicePackStatus> {
  if (!running) {
    running = installMissing().finally(() => {
      running = null
    })
  }
  return running
}
