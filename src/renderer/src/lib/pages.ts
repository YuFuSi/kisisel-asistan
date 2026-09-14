export type PageId = 'home' | 'chat' | 'tasks' | 'calendar' | 'notes' | 'settings'

export const PAGE_LABELS: Record<PageId, string> = {
  home: 'Ana Sayfa',
  chat: 'Asistan',
  tasks: 'Görevler',
  calendar: 'Takvim',
  notes: 'Hafıza Merkezi',
  settings: 'Ayarlar'
}
