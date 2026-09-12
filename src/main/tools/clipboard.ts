import { clipboard } from 'electron'
import { tool } from 'ai'
import { z } from 'zod'
import type { ToolModule } from './types'

// Modele gönderilecek en fazla pano metni (çok uzun panolar bağlamı doldurmasın)
const MAX_READ_LENGTH = 8000

const clipboardTools: ToolModule = {
  labels: {
    pano_oku: 'Panoyu okuma',
    pano_yaz: 'Panoya yazma'
  },
  tools: {
    pano_oku: tool({
      description:
        'Kullanıcının panosundaki (kopyaladığı) metni okur. "Panodakini özetle/çevir/düzelt" gibi isteklerde kullan.',
      inputSchema: z.object({}),
      execute: async () => {
        const text = clipboard.readText()
        if (!text.trim()) return { bos: true, metin: '' }
        return {
          bos: false,
          metin: text.slice(0, MAX_READ_LENGTH),
          kirpildi: text.length > MAX_READ_LENGTH,
          karakterSayisi: text.length
        }
      }
    }),

    pano_yaz: tool({
      description:
        'Verilen metni kullanıcının panosuna kopyalar; kullanıcı Ctrl+V ile yapıştırabilir. Kullanıcı "kopyala" veya "panoya al" derse kullan.',
      inputSchema: z.object({
        metin: z.string().min(1).describe('Panoya kopyalanacak metin')
      }),
      execute: async ({ metin }) => {
        clipboard.writeText(metin)
        return { kopyalandi: true, karakterSayisi: metin.length }
      }
    })
  }
}

export default clipboardTools
