export type PageId = 'chat' | 'tasks' | 'notes' | 'settings'

export const PAGE_LABELS: Record<PageId, string> = {
  chat: 'Sohbet',
  tasks: 'Görevler',
  notes: 'Notlar',
  settings: 'Ayarlar'
}
