import { tool } from 'ai'
import { z } from 'zod'
import { findPlace, getWeather } from '../lib/weather'
import type { ToolModule } from './types'

const weatherTools: ToolModule = {
  risks: { hava_durumu: 'read' },
  labels: { hava_durumu: 'Hava durumu' },
  tools: {
    hava_durumu: tool({
      description:
        'Bir şehrin şu anki hava durumunu ve önümüzdeki günlerin tahminini verir. Sıcaklıklar Celsius, rüzgar km/s.',
      inputSchema: z.object({
        sehir: z.string().describe('Şehir veya ilçe adı, ör. "İstanbul"'),
        gunSayisi: z
          .number()
          .int()
          .optional()
          .describe('Kaç günlük tahmin gerekiyor (1-7). Varsayılan 3.')
      }),
      execute: async (input) => {
        const place = await findPlace(input.sehir)
        return getWeather(place, input.gunSayisi ?? 3)
      }
    })
  }
}

export default weatherTools
