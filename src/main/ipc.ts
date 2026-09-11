import { ipcMain } from 'electron'
import { sendMessage, stopChat } from './ai/chat'
import { listOllamaModels, testConnection } from './ai/providers'
import {
  createConversation,
  deleteConversation,
  listConversations,
  listMessages
} from './conversations'
import { getSettingsView, setApiKey, updateSettings } from './settings'
import type { CloudProviderId, SettingsPatch } from '../shared/api'

// Arayüzün (renderer) çağırabileceği tüm işlemler burada tanımlı.
// Kanal adları src/preload/index.ts ile birebir aynı olmalı.
export function registerIpcHandlers(): void {
  ipcMain.handle('settings:get', () => getSettingsView())
  ipcMain.handle('settings:update', (_event, patch: SettingsPatch) => {
    updateSettings(patch)
    return getSettingsView()
  })
  ipcMain.handle('settings:setApiKey', (_event, provider: CloudProviderId, key: string) => {
    setApiKey(provider, key)
    return getSettingsView()
  })
  ipcMain.handle('settings:testConnection', () => testConnection())

  ipcMain.handle('ollama:listModels', () => listOllamaModels())

  ipcMain.handle('conversations:list', () => listConversations())
  ipcMain.handle('conversations:create', () => createConversation())
  ipcMain.handle('conversations:remove', (_event, id: number) => {
    stopChat(id)
    deleteConversation(id)
  })
  ipcMain.handle('conversations:messages', (_event, id: number) => listMessages(id))

  ipcMain.handle('chat:send', (event, conversationId: number, text: string) =>
    sendMessage(event.sender, conversationId, text)
  )
  ipcMain.handle('chat:stop', (_event, conversationId: number) => stopChat(conversationId))
}
