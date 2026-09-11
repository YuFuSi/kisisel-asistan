import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { Api, ChatEvent } from '../shared/api'

// Arayüze sadece bu listedeki işlemler açılır; ham ipcRenderer erişimi verilmez.
const api: Api = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch) => ipcRenderer.invoke('settings:update', patch),
    setApiKey: (provider, key) => ipcRenderer.invoke('settings:setApiKey', provider, key),
    testConnection: () => ipcRenderer.invoke('settings:testConnection')
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
    onEvent: (listener) => {
      const handler = (_event: IpcRendererEvent, chatEvent: ChatEvent): void => listener(chatEvent)
      ipcRenderer.on('chat:event', handler)
      return () => ipcRenderer.removeListener('chat:event', handler)
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
