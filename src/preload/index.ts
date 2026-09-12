import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { Api, AppCommand, ChatEvent, DataScope } from '../shared/api'

// Arayüze sadece bu listedeki işlemler açılır; ham ipcRenderer erişimi verilmez.
// Kanal adları src/main/ipc.ts ile birebir aynı olmalı.
const api: Api = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch) => ipcRenderer.invoke('settings:update', patch),
    setSecret: (id, key) => ipcRenderer.invoke('settings:setSecret', id, key),
    testConnection: () => ipcRenderer.invoke('settings:testConnection'),
    suspendShortcut: (suspended) => ipcRenderer.invoke('settings:suspendShortcut', suspended)
  },
  ollama: {
    listModels: () => ipcRenderer.invoke('ollama:listModels')
  },
  conversations: {
    list: () => ipcRenderer.invoke('conversations:list'),
    create: () => ipcRenderer.invoke('conversations:create'),
    remove: (id) => ipcRenderer.invoke('conversations:remove', id),
    messages: (id) => ipcRenderer.invoke('conversations:messages', id)
  },
  chat: {
    send: (conversationId, text) => ipcRenderer.invoke('chat:send', conversationId, text),
    stop: (conversationId) => ipcRenderer.invoke('chat:stop', conversationId),
    respondToApproval: (approvalId, approved) =>
      ipcRenderer.invoke('chat:respondToApproval', approvalId, approved),
    onEvent: (listener) => {
      const handler = (_event: IpcRendererEvent, chatEvent: ChatEvent): void => listener(chatEvent)
      ipcRenderer.on('chat:event', handler)
      return () => ipcRenderer.removeListener('chat:event', handler)
    }
  },
  tasks: {
    list: () => ipcRenderer.invoke('tasks:list'),
    create: (input) => ipcRenderer.invoke('tasks:create', input),
    update: (id, patch) => ipcRenderer.invoke('tasks:update', id, patch),
    remove: (id) => ipcRenderer.invoke('tasks:remove', id)
  },
  reminders: {
    list: () => ipcRenderer.invoke('reminders:list'),
    create: (message, remindAt) => ipcRenderer.invoke('reminders:create', message, remindAt),
    remove: (id) => ipcRenderer.invoke('reminders:remove', id)
  },
  notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    create: (input) => ipcRenderer.invoke('notes:create', input),
    update: (id, patch) => ipcRenderer.invoke('notes:update', id, patch),
    remove: (id) => ipcRenderer.invoke('notes:remove', id)
  },
  memories: {
    list: () => ipcRenderer.invoke('memories:list'),
    create: (content) => ipcRenderer.invoke('memories:create', content),
    remove: (id) => ipcRenderer.invoke('memories:remove', id)
  },
  google: {
    status: () => ipcRenderer.invoke('google:status'),
    connect: () => ipcRenderer.invoke('google:connect'),
    disconnect: () => ipcRenderer.invoke('google:disconnect')
  },
  events: {
    onDataChanged: (listener) => {
      const handler = (_event: IpcRendererEvent, scope: DataScope): void => listener(scope)
      ipcRenderer.on('data:changed', handler)
      return () => ipcRenderer.removeListener('data:changed', handler)
    },
    onCommand: (listener) => {
      const handler = (_event: IpcRendererEvent, command: AppCommand): void => listener(command)
      ipcRenderer.on('app:command', handler)
      return () => ipcRenderer.removeListener('app:command', handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (index.d.ts içinde tanımlı)
  window.api = api
}
