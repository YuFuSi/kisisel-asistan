import type { UsageStats } from './analytics'

export interface Achievement {
  id: string
  title: string
  description: string
  achieved: boolean
}

/**
 * Rozetler tamamen activity_log'dan hesaplanır, hiçbir şey dışarı gönderilmez. Sıra: kazanılanlar
 * önce, sonra hedefe en yakın olan kazanılmamışlar (basit bir "sırada bu var" hissi versin diye).
 */
export function computeAchievements(stats: UsageStats): Achievement[] {
  const list: (Achievement & { progress: number })[] = [
    {
      id: 'first-step',
      title: 'İlk adım',
      description: 'Pıtır ilk kez bir araç kullandı.',
      achieved: stats.totalCalls >= 1,
      progress: Math.min(1, stats.totalCalls / 1)
    },
    {
      id: 'hundred-calls',
      title: '100. komut',
      description: '100 araç çağrısına ulaşıldı.',
      achieved: stats.totalCalls >= 100,
      progress: Math.min(1, stats.totalCalls / 100)
    },
    {
      id: 'streak-3',
      title: 'Alışkanlık',
      description: '3 gün üst üste Pıtır kullanıldı.',
      achieved: stats.activeDayStreak >= 3,
      progress: Math.min(1, stats.activeDayStreak / 3)
    },
    {
      id: 'streak-7',
      title: 'Düzenli kullanıcı',
      description: '7 gün üst üste Pıtır kullanıldı.',
      achieved: stats.activeDayStreak >= 7,
      progress: Math.min(1, stats.activeDayStreak / 7)
    },
    {
      id: 'voice-user',
      title: 'Sesle konuştu',
      description: 'Sesli sohbetle en az bir araç çalıştırıldı.',
      achieved: stats.voiceCalls >= 1,
      progress: Math.min(1, stats.voiceCalls / 1)
    },
    {
      id: 'automation-master',
      title: 'Otomasyon ustası',
      description: 'Bir rutin kendiliğinden çalışıp bir araç kullandı.',
      achieved: stats.automationCalls >= 1,
      progress: Math.min(1, stats.automationCalls / 1)
    },
    {
      id: 'versatile',
      title: 'Çok yönlü',
      description: '8 farklı araç en az bir kez kullanıldı.',
      achieved: stats.distinctTools >= 8,
      progress: Math.min(1, stats.distinctTools / 8)
    }
  ]

  return [...list]
    .sort((a, b) => {
      if (a.achieved !== b.achieved) return a.achieved ? -1 : 1
      return b.progress - a.progress
    })
    .map(({ id, title, description, achieved }) => ({ id, title, description, achieved }))
}
