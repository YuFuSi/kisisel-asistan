import { app } from 'electron'
import { parse } from 'node:path'
import si from 'systeminformation'
import { listOllamaModels } from '../ai/providers'
import { listBackups } from '../db/backup'
import { getGoogleStatus } from '../google/auth'
import { getSecret, getSettings } from '../settings'
import { backupDirectory } from './database'
import { PROVIDERS, isCloudProvider, type SystemStatus } from '../../shared/api'

async function modelStatus(): Promise<SystemStatus['model']> {
  const { provider, models } = getSettings()
  const label = PROVIDERS[provider].label
  const model = models[provider]
  if (!model) return { label, model, ok: false, message: 'Model seçilmedi' }

  if (isCloudProvider(provider)) {
    const ok = getSecret(provider) !== undefined
    return { label, model, ok, message: ok ? 'Hazır' : 'API anahtarı yok' }
  }
  try {
    const installed = await listOllamaModels()
    const ok = installed.includes(model)
    return { label, model, ok, message: ok ? 'Çalışıyor' : 'Model yüklü değil' }
  } catch {
    return { label, model, ok: false, message: 'Ollama kapalı' }
  }
}

/** Veri klasörünün bulunduğu diskin boş alanı */
async function diskStatus(): Promise<SystemStatus['disk']> {
  try {
    const drive = parse(app.getPath('userData'))
      .root.replace(/[\\/]+$/, '')
      .toUpperCase()
    const disks = await si.fsSize()
    const disk = disks.find((item) => item.mount.toUpperCase() === drive) ?? disks[0]
    return disk ? { free: disk.available, total: disk.size } : null
  } catch {
    return null
  }
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const [model, disk] = await Promise.all([modelStatus(), diskStatus()])
  return {
    model,
    googleConnected: getGoogleStatus().connected,
    lastBackupAt: listBackups(backupDirectory())[0]?.createdAt ?? null,
    disk
  }
}
