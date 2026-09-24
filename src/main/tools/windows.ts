import { tool } from 'ai'
import { z } from 'zod'
import {
  closeWindow,
  focusWindow,
  listWindows,
  minimizeWindow,
  moveWindow,
  resizeWindow
} from '../lib/windows'
import { requireApproval } from './approval'
import type { ToolModule } from './types'

// Tur L: bilgisayarı yönetme, ilk küçük dilim. Sadece görünür (görev çubuğundaki) pencerelerle
// çalışır; kapatma dışındaki eylemler geri alınabilir (öne getirme, küçültme) ve düşük risklidir.
// Kapatma, programın kendi WM_CLOSE akışını tetikler (zorla süreç öldürmez), yine de onay ister.
const windowTools: ToolModule = {
  risks: {
    pencereleri_listele: 'read',
    pencereyi_odakla: 'write',
    pencereyi_kucult: 'write',
    pencereyi_tasi: 'write',
    pencereyi_boyutlandir: 'write',
    pencereyi_kapat: 'dangerous'
  },
  selfApproval: ['pencereyi_kapat'],
  labels: {
    pencereleri_listele: 'Pencereleri listeleme',
    pencereyi_odakla: 'Pencereyi öne getirme',
    pencereyi_kucult: 'Pencereyi küçültme',
    pencereyi_tasi: 'Pencereyi taşıma',
    pencereyi_boyutlandir: 'Pencereyi boyutlandırma',
    pencereyi_kapat: 'Pencereyi kapatma'
  },
  tools: {
    pencereleri_listele: tool({
      description:
        'Açık ve görev çubuğunda görünen pencereleri listeler (başlık ve süreç adı). Bir pencereyle ' +
        'ilgili başka bir araç çağırmadan önce doğru "kimlik" değerini bulmak için bunu kullan.',
      inputSchema: z.object({}),
      execute: async () => {
        const windows = await listWindows()
        return { adet: windows.length, pencereler: windows }
      }
    }),

    pencereyi_odakla: tool({
      description:
        'Bir pencereyi öne getirir ve ona odaklanır (simge durumundaysa geri yükler). Kimliği ' +
        'pencereleri_listele aracından al.',
      inputSchema: z.object({
        kimlik: z.number().int().describe('pencereleri_listele sonucundaki "id" değeri')
      }),
      execute: async (input) => {
        await focusWindow(input.kimlik)
        return { odaklandi: true }
      }
    }),

    pencereyi_kucult: tool({
      description: "Bir pencereyi görev çubuğuna küçültür. Kimliği pencereleri_listele'den al.",
      inputSchema: z.object({
        kimlik: z.number().int().describe('pencereleri_listele sonucundaki "id" değeri')
      }),
      execute: async (input) => {
        await minimizeWindow(input.kimlik)
        return { kucultuldu: true }
      }
    }),

    pencereyi_tasi: tool({
      description:
        "Bir pencereyi ekranda verilen konuma taşır (boyutu değişmez). Kimliği pencereleri_listele'den " +
        'al. Konum ekranın sol üst köşesine göre piksel cinsindendir.',
      inputSchema: z.object({
        kimlik: z.number().int().describe('pencereleri_listele sonucundaki "id" değeri'),
        x: z.number().int().describe('Sol kenarın ekrandaki x konumu (px)'),
        y: z.number().int().describe('Üst kenarın ekrandaki y konumu (px)')
      }),
      execute: async (input) => {
        await moveWindow(input.kimlik, input.x, input.y)
        return { tasindi: true }
      }
    }),

    pencereyi_boyutlandir: tool({
      description:
        'Bir pencereyi verilen genişlik/yüksekliğe getirir (konumu değişmez). Kimliği ' +
        "pencereleri_listele'den al.",
      inputSchema: z.object({
        kimlik: z.number().int().describe('pencereleri_listele sonucundaki "id" değeri'),
        genislik: z.number().int().describe('Piksel cinsinden yeni genişlik'),
        yukseklik: z.number().int().describe('Piksel cinsinden yeni yükseklik')
      }),
      execute: async (input) => {
        await resizeWindow(input.kimlik, input.genislik, input.yukseklik)
        return { boyutlandirildi: true }
      }
    }),

    pencereyi_kapat: tool({
      description:
        'Bir pencereyi kapatır (programın kendi kapatma akışını tetikler; kaydedilmemiş değişiklik ' +
        "varsa program kaydetme sorabilir). Kimliği pencereleri_listele'den al. Onay ister.",
      inputSchema: z.object({
        kimlik: z.number().int().describe('pencereleri_listele sonucundaki "id" değeri'),
        baslik: z.string().optional().describe('Onay kartında gösterilecek pencere başlığı')
      }),
      execute: async (input) => {
        await requireApproval({
          toolName: 'pencereyi_kapat',
          label: 'Pencere kapatılsın mı?',
          summary: input.baslik ?? `Pencere #${input.kimlik}`
        })
        await closeWindow(input.kimlik)
        return { kapatildi: true }
      }
    })
  }
}

export default windowTools
