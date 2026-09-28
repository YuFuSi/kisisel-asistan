import { tool } from 'ai'
import { z } from 'zod'
import { scheduleMemoryEmbedding } from '../ai/memoryEmbeddings'
import { searchPastConversations } from '../ai/pastSearch'
import { createMemory, deleteMemory, listMemories } from '../data/memories'
import { notifyDataChanged } from '../events'
import type { ToolModule } from './types'

const memoryTools: ToolModule = {
  risks: {
    hafizaya_kaydet: 'write',
    hafizayi_listele: 'read',
    hafizadan_sil: 'write',
    gecmiste_ara: 'read'
  },
  labels: {
    hafizaya_kaydet: 'Hafızaya kaydetme',
    hafizayi_listele: 'Hafızaya bakma',
    hafizadan_sil: 'Hafızadan silme',
    gecmiste_ara: 'Geçmiş konuşmalarda arama'
  },
  tools: {
    hafizaya_kaydet: tool({
      description:
        'Kullanıcı hakkında kalıcı olarak hatırlanması gereken kısa bir bilgiyi kaydeder: tercihler, alışkanlıklar, önemli kişiler veya tarihler. Kaydedilen bilgiler sonraki tüm sohbetlerde sana verilir. Çok benzer bir bilgi zaten varsa yenisiyle güncellenir.',
      inputSchema: z.object({
        bilgi: z
          .string()
          .describe(
            'Kullanıcı hakkında kısa bilgi, üçüncü şahıs ağzıyla, ör. "Kahvesini şekersiz içer"'
          )
      }),
      execute: async (input) => {
        const before = listMemories().length
        const memory = createMemory(input.bilgi)
        scheduleMemoryEmbedding(memory.id, memory.content)
        notifyDataChanged('memories')
        return {
          kaydedildi: true,
          bilgi: memory.content,
          // Sayı artmadıysa benzer kayıt güncellenmiştir
          mevcutKayitGuncellendi: listMemories().length === before
        }
      }
    }),

    hafizayi_listele: tool({
      description:
        'Kullanıcı hakkında hafızada kayıtlı bilgileri numaralarıyla listeler. Silmeden önce doğru kaydı bulmak için kullan.',
      inputSchema: z.object({}),
      execute: async () => ({
        kayitlar: listMemories().map((memory) => ({ id: memory.id, bilgi: memory.content }))
      })
    }),

    hafizadan_sil: tool({
      description:
        'Kullanıcı "bunu unut", "artık doğru değil" derse ilgili hafıza kaydını siler. id numarasını bilmiyorsan önce hafizayi_listele kullan.',
      inputSchema: z.object({
        id: z.number().int().describe('Silinecek hafıza kaydının numarası')
      }),
      execute: async (input) => {
        const memory = listMemories().find((m) => m.id === input.id)
        if (!memory) throw new Error(`${input.id} numaralı hafıza kaydı yok.`)
        deleteMemory(input.id)
        notifyDataChanged('memories')
        return { silindi: true, bilgi: memory.content }
      }
    }),

    gecmiste_ara: tool({
      description:
        'Kullanıcıyla daha önceki (başka) sohbetlerde konuşulanları arar. Kullanıcı "geçen sefer", "daha önce", "hangi gün ... konuşmuştuk", "sana ... demiştim" gibi bir şey sorarsa veya bir bilgiyi hatırlamıyorsan "hatırlamıyorum" demeden ÖNCE bunu kullan.',
      inputSchema: z.object({
        sorgu: z.string().describe('Aranan konu, ör. "iş ilanı" veya "annemin doğum günü"')
      }),
      execute: async (input) => {
        const sonuclar = await searchPastConversations(input.sorgu)
        return { bulunan: sonuclar.length, sonuclar }
      }
    })
  }
}

export default memoryTools
