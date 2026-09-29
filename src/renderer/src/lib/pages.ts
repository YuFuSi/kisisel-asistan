// Sayfa kimlikleri. 'automations' ve 'achievements' artık ayrı sayfa değil (tasarım turu):
// App.navigate onları Planlama > Rutinler ve Analizler'e yönlendirir; bildirim, komut paleti ve
// yörünge eski kimlikleri kullanmaya devam edebilir.
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
  tasks: 'Planlama',
  calendar: 'Takvim',
  notes: 'Hafıza',
  automations: 'Rutinler',
  analytics: 'Analizler',
  achievements: 'Başarımlar',
  gestures: 'Kamera (deneme)',
  settings: 'Ayarlar'
}
