import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { listActivity } from './data/activity'
import { listBackups } from './db/backup'
import { backupDirectory, createBackupNow, restoreBackup } from './system/database'
import { logRendererError, openLogDirectory } from './system/logger'
import { getSystemStatus } from './system/status'
import { getVoicePackStatus, installVoicePack } from './voice/packManager'
import {
  getVoiceState,
  pushVoiceAudio,
  speakWithVoice,
  startVoiceTurn,
  stopVoiceSession,
  stopVoiceSpeaking,
  voicePlaybackEnded
} from './voice/session'
import { fetchCalendarEvents, toCalendarItem } from './google/calendar'
import { promises as fs } from 'node:fs'
import { editAndResend, regenerateReply, sendMessage, stopChat } from './ai/chat'
import { respondToApproval } from './tools/approval'
import { connectGoogle, disconnectGoogle, getGoogleStatus } from './google/auth'
import { listOllamaModels, testConnection } from './ai/providers'
import { transcribeAudio } from './ai/speech'
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  listMessages,
  renameConversation,
  searchConversations,
  setConversationPinned
} from './data/conversations'
import { conversationToMarkdown, suggestFileName } from './lib/markdownExport'
import { readDocumentPart } from './lib/documents'
import { showDailyBrief } from './scheduler/brief'
import { allowDocument } from './tools/documents'
import { createMemory, deleteMemory, listMemories, updateMemory } from './data/memories'
import { createNote, deleteNote, listNotes, updateNote } from './data/notes'
import {
  createReminder,
  deleteReminder,
  listPendingReminders,
  snoozeReminder
} from './data/reminders'
import { createTask, deleteTask, listTasks, updateTask } from './data/tasks'
import { notifyDataChanged } from './events'
import { setSecret } from './settings'
import { applySettingsPatch, getSettingsView } from './system/appSettings'
import { suspendGlobalShortcut } from './system/shortcut'
import type {
  AttachedDocument,
  CalendarItem,
  DataScope,
  NotePatch,
  RepeatRule,
  SecretId,
  SettingsPatch,
  TaskInput,
  TaskPatch
} from '../shared/api'

// Veriyi değiştiren işlemden sonra açık sayfalara "bu veri değişti" haberi gönder
function changing<T>(scope: DataScope, action: () => T): T {
  const result = action()
  notifyDataChanged(scope)
  return result
}

// Sohbeti Markdown olarak diske kaydeder. Kullanıcı vazgeçerse null döner.
async function exportConversation(id: number): Promise<string | null> {
  const conversation = getConversation(id)
  if (!conversation) throw new Error('Sohbet bulunamadı.')

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Sohbeti kaydet',
    defaultPath: suggestFileName(conversation),
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (canceled || !filePath) return null

  await fs.writeFile(filePath, conversationToMarkdown(conversation, listMessages(id)), 'utf8')
  return filePath
}

// Arayüzün (renderer) çağırabileceği tüm işlemler burada tanımlı.
// Kanal adları src/preload/index.ts ile birebir aynı olmalı.
export function registerIpcHandlers(): void {
  // Uygulama
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('brief:preview', () => showDailyBrief())
  // Cevap beklenmez; arayüzdeki hata sadece günlüğe yazılır
  ipcMain.on('app:logError', (_event, message: string) => logRendererError(message))
  ipcMain.handle('app:openLogs', () => openLogDirectory())

  // Yedekler ve etkinlik kaydı
  ipcMain.handle('backups:list', () => listBackups(backupDirectory()))
  ipcMain.handle('backups:create', () => createBackupNow())
  ipcMain.handle('backups:restore', (event, name: string) =>
    restoreBackup(BrowserWindow.fromWebContents(event.sender), name)
  )
  ipcMain.handle('activity:list', (_event, limit?: number) => listActivity(limit))

  // Ana Sayfa ve Takvim
  ipcMain.handle('system:status', () => getSystemStatus())

  // Jarvis sesi. Mikrofon sesi ve "çalma bitti" haberi sık geldiği için cevap beklenmez (on)
  ipcMain.handle('voice:packStatus', () => getVoicePackStatus())
  ipcMain.handle('voice:installPack', () => installVoicePack())
  ipcMain.handle('voice:state', () => getVoiceState())
  ipcMain.on('voice:pushAudio', (_event, chunk: unknown) => pushVoiceAudio(chunk))
  ipcMain.handle('voice:startTurn', () => startVoiceTurn())
  ipcMain.handle('voice:stopSession', () => stopVoiceSession())
  ipcMain.handle('voice:speak', (_event, text: string) => speakWithVoice(String(text)))
  ipcMain.handle('voice:stopSpeaking', () => stopVoiceSpeaking())
  ipcMain.on('voice:playbackEnded', (_event, id: number) => voicePlaybackEnded(Number(id)))
  ipcMain.handle(
    'calendar:events',
    async (_event, from: string, to: string): Promise<CalendarItem[]> => {
      if (!getGoogleStatus().connected) return []
      const start = new Date(from)
      const end = new Date(to)
      const days = (end.getTime() - start.getTime()) / 86_400_000
      if (!(days > 0 && days <= 62)) throw new Error('Geçersiz takvim aralığı.')
      const events = await fetchCalendarEvents(start, end, 250)
      return events.map(toCalendarItem).filter((item): item is CalendarItem => item !== null)
    }
  )

  // Belgeler: kullanıcının sohbete bıraktığı dosya
  ipcMain.handle(
    'documents:read',
    async (_event, conversationId: number, path: string): Promise<AttachedDocument> => {
      const document = await readDocumentPart(path, 1)
      allowDocument(conversationId, path)
      return {
        name: document.name,
        path,
        text: document.text,
        partCount: document.partCount,
        charCount: document.charCount
      }
    }
  )

  // Ayarlar
  ipcMain.handle('settings:get', () => getSettingsView())
  ipcMain.handle('settings:update', (_event, patch: SettingsPatch) => applySettingsPatch(patch))
  ipcMain.handle('settings:setSecret', (_event, id: SecretId, key: string) =>
    changing('settings', () => {
      setSecret(id, key)
      return getSettingsView()
    })
  )
  ipcMain.handle('settings:testConnection', () => testConnection())
  ipcMain.handle('settings:suspendShortcut', (_event, suspended: boolean) =>
    suspendGlobalShortcut(suspended)
  )
  ipcMain.handle('ollama:listModels', () => listOllamaModels())

  // Ses
  ipcMain.handle('speech:transcribe', (_event, audio: ArrayBuffer, mimeType: string) =>
    transcribeAudio(audio, mimeType)
  )

  // Google hesabı (Gmail ve Takvim)
  ipcMain.handle('google:status', () => getGoogleStatus())
  ipcMain.handle('google:connect', async () => {
    const status = await connectGoogle()
    notifyDataChanged('settings')
    return status
  })
  ipcMain.handle('google:disconnect', async () => {
    const status = await disconnectGoogle()
    notifyDataChanged('settings')
    return status
  })

  // Sohbet
  ipcMain.handle('conversations:list', () => listConversations())
  ipcMain.handle('conversations:create', () =>
    changing('conversations', () => createConversation())
  )
  ipcMain.handle('conversations:remove', (_event, id: number) =>
    changing('conversations', () => {
      stopChat(id)
      deleteConversation(id)
    })
  )
  ipcMain.handle('conversations:messages', (_event, id: number) => listMessages(id))
  ipcMain.handle('conversations:rename', (_event, id: number, title: string) =>
    changing('conversations', () => renameConversation(id, title))
  )
  ipcMain.handle('conversations:pin', (_event, id: number, pinned: boolean) =>
    changing('conversations', () => setConversationPinned(id, pinned))
  )
  ipcMain.handle('conversations:search', (_event, query: string) => searchConversations(query))
  ipcMain.handle('conversations:export', (_event, id: number) => exportConversation(id))

  ipcMain.handle('chat:send', (event, conversationId: number, text: string) =>
    sendMessage(event.sender, conversationId, text)
  )
  ipcMain.handle('chat:stop', (_event, conversationId: number) => stopChat(conversationId))
  ipcMain.handle('chat:regenerate', (event, conversationId: number) =>
    regenerateReply(event.sender, conversationId)
  )
  ipcMain.handle(
    'chat:editAndResend',
    (event, conversationId: number, messageId: number, text: string) =>
      editAndResend(event.sender, conversationId, messageId, text)
  )
  ipcMain.handle('chat:respondToApproval', (_event, approvalId: string, approved: boolean) =>
    respondToApproval(approvalId, approved)
  )

  // Görevler
  ipcMain.handle('tasks:list', () => listTasks())
  ipcMain.handle('tasks:create', (_event, input: TaskInput) =>
    changing('tasks', () => createTask(input))
  )
  ipcMain.handle('tasks:update', (_event, id: number, patch: TaskPatch) =>
    changing('tasks', () => updateTask(id, patch))
  )
  ipcMain.handle('tasks:remove', (_event, id: number) => changing('tasks', () => deleteTask(id)))

  // Hatırlatmalar
  ipcMain.handle('reminders:list', () => listPendingReminders())
  ipcMain.handle(
    'reminders:create',
    (_event, message: string, remindAt: number, repeat: RepeatRule = 'none') =>
      changing('reminders', () => createReminder(message, remindAt, repeat))
  )
  ipcMain.handle('reminders:remove', (_event, id: number) =>
    changing('reminders', () => deleteReminder(id))
  )
  ipcMain.handle('reminders:snooze', (_event, id: number, minutes: number) =>
    changing('reminders', () => snoozeReminder(id, minutes))
  )

  // Notlar
  ipcMain.handle('notes:list', () => listNotes())
  ipcMain.handle('notes:create', (_event, input: NotePatch) =>
    changing('notes', () => createNote(input))
  )
  ipcMain.handle('notes:update', (_event, id: number, patch: NotePatch) =>
    changing('notes', () => updateNote(id, patch))
  )
  ipcMain.handle('notes:remove', (_event, id: number) => changing('notes', () => deleteNote(id)))

  // Hafıza
  ipcMain.handle('memories:list', () => listMemories())
  ipcMain.handle('memories:create', (_event, content: string) =>
    changing('memories', () => createMemory(content))
  )
  ipcMain.handle('memories:update', (_event, id: number, content: string) =>
    changing('memories', () => updateMemory(id, content))
  )
  ipcMain.handle('memories:remove', (_event, id: number) =>
    changing('memories', () => deleteMemory(id))
  )
}
