import { tool } from 'ai'
import { z } from 'zod'
import { collectDailyBrief } from '../ai/brief'
import type { ToolModule } from './types'

const briefTools: ToolModule = {
  labels: { gunluk_ozet: 'Günlük özet' },
  tools: {
    gunluk_ozet: tool({
      description:
        'Kullanıcının bugünkü özetini toplar: hava durumu, bekleyen ve geciken görevler, bugünkü hatırlatmalar, takvim etkinlikleri ve okunmamış e-posta sayısı. "Günlük özetimi hazırla", "bugün neler var", "sabah özeti" gibi isteklerde kullan.',
      inputSchema: z.object({}),
      execute: async () => collectDailyBrief()
    })
  }
}

export default briefTools
