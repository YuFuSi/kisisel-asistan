import { isDbOpen } from './db'
import { logActivity, type ActivityInput } from './data/activity'
import { notifyDataChanged } from './events'

/**
 * İşlemi etkinlik kaydına yazar ve açık sayfalara haber verir.
 * Kayıt yazılamasa bile asıl işlem etkilenmez (ör. testlerde veritabanı açık değildir).
 */
export function recordActivity(input: ActivityInput): void {
  if (!isDbOpen()) return
  try {
    logActivity(input)
    notifyDataChanged('activity')
  } catch (err) {
    console.warn('Etkinlik kaydedilemedi:', err)
  }
}
