import { tool } from 'ai'
import { z } from 'zod'
import { createMemory } from '../data/memories'
import { notifyDataChanged } from '../events'
import type { ToolModule } from './types'

const memoryTools: ToolModule = {
  labels: {
    hafizaya_kaydet: 'Hafızaya kaydetme'
  },
  tools: {
    hafizaya_kaydet: tool({
      description:
        'Kullanıcı hakkında kalıcı olarak hatırlanması gereken kısa bir bilgiyi kaydeder: tercihler, alışkanlıklar, önemli kişiler veya tarihler. Kaydedilen bilgiler sonraki tüm sohbetlerde sana verilir.',
      inputSchema: z.object({
        bilgi: z
          .string()
          .describe(
            'Kullanıcı hakkında kısa bilgi, üçüncü şahıs ağzıyla, ör. "Kahvesini şekersiz içer"'
          )
      }),
      execute: async ({ bilgi }) => {
        const memory = createMemory(bilgi)
        notifyDataChanged('memories')
        return { kaydedildi: true, bilgi: memory.content }
      }
    })
  }
}

export default memoryTools
