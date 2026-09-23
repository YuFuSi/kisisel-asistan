export type PageId =
  | 'home'
  | 'chat'
  | 'tasks'
  | 'calendar'
  | 'notes'
  | 'automations'
  | 'analytics'
  | 'achievements'
  | 'gestures'
  | 'settings'

export const PAGE_LABELS: Record<PageId, string> = {
  home: 'Ana Sayfa',
  chat: 'Asistan',
  tasks: 'Görevler',
  calendar: 'Takvim',
  notes: 'Hafıza Merkezi',
  automations: 'Otomasyonlar',
  analytics: 'Analizler',
  achievements: 'Başarımlar',
  gestures: 'Kamera (deneme)',
  settings: 'Ayarlar'
}
