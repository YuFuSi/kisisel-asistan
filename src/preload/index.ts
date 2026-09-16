import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import type { Api, AppCommand, ChatEvent, DataScope, VoiceEvent } from '../shared/api'

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
  app: {
    version: () => ipcRenderer.invoke('app:version'),
    logError: (message) => ipcRenderer.send('app:logError', message),
    openLogs: () => ipcRenderer.invoke('app:openLogs')
  },
  backups: {
    list: () => ipcRenderer.invoke('backups:list'),
    create: () => ipcRenderer.invoke('backups:create'),
    restore: (name) => ipcRenderer.invoke('backups:restore', name)
  },
  activity: {
    list: (limit) => ipcRenderer.invoke('activity:list', limit)
  },
  calendar: {
    events: (from, to) => ipcRenderer.invoke('calendar:events', from, to)
  },
  system: {
    status: () => ipcRenderer.invoke('system:status')
  },
  documents: {
    pathForFile: (file) => webUtils.getPathForFile(file),
    read: (conversationId, path) => ipcRenderer.invoke('documents:read', conversationId, path)
  },
  brief: {
    preview: () => ipcRenderer.invoke('brief:preview')
  },
  conversations: {
    list: () => ipcRenderer.invoke('conversations:list'),
    create: () => ipcRenderer.invoke('conversations:create'),
    remove: (id) => ipcRenderer.invoke('conversations:remove', id),
    messages: (id) => ipcRenderer.invoke('conversations:messages', id),
    rename: (id, title) => ipcRenderer.invoke('conversations:rename', id, title),
    pin: (id, pinned) => ipcRenderer.invoke('conversations:pin', id, pinned),
    search: (query) => ipcRenderer.invoke('conversations:search', query),
    exportMarkdown: (id) => ipcRenderer.invoke('conversations:export', id)
  },
  chat: {
    send: (conversationId, text) => ipcRenderer.invoke('chat:send', conversationId, text),
    stop: (conversationId) => ipcRenderer.invoke('chat:stop', conversationId),
    regenerate: (conversationId) => ipcRenderer.invoke('chat:regenerate', conversationId),
    editAndResend: (conversationId, messageId, text) =>
      ipcRenderer.invoke('chat:editAndResend', conversationId, messageId, text),
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
    create: (message, remindAt, repeat) =>
      ipcRenderer.invoke('reminders:create', message, remindAt, repeat),
    remove: (id) => ipcRenderer.invoke('reminders:remove', id),
    snooze: (id, minutes) => ipcRenderer.invoke('reminders:snooze', id, minutes)
  },
  notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    create: (input) => ipcRenderer.invoke('notes:create', input),
    update: (id, patch) => ipcRenderer.invoke('notes:update', id, patch),
    remove: (id) => ipcRenderer.invoke('notes:remove', id),
    backfillEmbeddings: () => ipcRenderer.invoke('notes:backfillEmbeddings')
  },
  memories: {
    list: () => ipcRenderer.invoke('memories:list'),
    create: (content) => ipcRenderer.invoke('memories:create', content),
    update: (id, content) => ipcRenderer.invoke('memories:update', id, content),
    remove: (id) => ipcRenderer.invoke('memories:remove', id),
    backfillEmbeddings: () => ipcRenderer.invoke('memories:backfillEmbeddings')
  },
  speech: {
    transcribe: (audio, mimeType) => ipcRenderer.invoke('speech:transcribe', audio, mimeType)
  },
  voice: {
    packStatus: () => ipcRenderer.invoke('voice:packStatus'),
    installPack: () => ipcRenderer.invoke('voice:installPack'),
    state: () => ipcRenderer.invoke('voice:state'),
    pushAudio: (chunk) => ipcRenderer.send('voice:pushAudio', chunk),
    startTurn: () => ipcRenderer.invoke('voice:startTurn'),
    stopSession: () => ipcRenderer.invoke('voice:stopSession'),
    speak: (text) => ipcRenderer.invoke('voice:speak', text),
    stopSpeaking: () => ipcRenderer.invoke('voice:stopSpeaking'),
    playbackEnded: (id) => ipcRenderer.send('voice:playbackEnded', id),
    onEvent: (listener) => {
      const handler = (_event: IpcRendererEvent, voiceEvent: VoiceEvent): void =>
        listener(voiceEvent)
      ipcRenderer.on('voice:event', handler)
      return () => ipcRenderer.removeListener('voice:event', handler)
    }
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
