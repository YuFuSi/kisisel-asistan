import { tool } from 'ai'
import { z } from 'zod'
import { createTask, listTasks, updateTask } from '../data/tasks'
import { notifyDataChanged } from '../events'
import { parseLocalDate } from '../lib/datetime'
import type { ToolModule } from './types'

const taskTools: ToolModule = {
  risks: { gorev_ekle: 'write', gorevleri_listele: 'read', gorev_tamamla: 'write' },
  labels: {
    gorev_ekle: 'Görev ekleme',
    gorevleri_listele: 'Görev listesi',
    gorev_tamamla: 'Görev tamamlama'
  },
  tools: {
    gorev_ekle: tool({
      description:
        'Kullanıcının yapılacaklar listesine yeni bir görev ekler. "Listeme ekle", "görev ekle", "yapılacaklara yaz" gibi isteklerde bunu kullan; takvim etkinliği değildir.',
      inputSchema: z.object({
        baslik: z.string().describe('Görevin kısa başlığı, ör. "Market alışverişi"'),
        sonTarih: z
          .string()
          .optional()
          .describe(
            'SADECE kullanıcı bir gün söylediyse doldur, YYYY-MM-DD biçiminde. Gün söylenmediyse bu alanı hiç gönderme.'
          ),
        saat: z
          .string()
          .optional()
          .describe(
            'SADECE kullanıcı saatli bir görev söylediyse doldur ("14:00\'te toplantı" gibi), HH:mm biçiminde. sonTarih olmadan saat gönderme; sadece saat söylenip gün söylenmediyse (ör. "bugün 14:00") sonTarih\'i bugünün tarihiyle doldur.'
          ),
        aciklama: z
          .string()
          .optional()
          .describe('SADECE kullanıcı ek ayrıntı verdiyse doldur. Kendinden açıklama uydurma.')
      }),
      // Parametre burada { baslik, ... } diye parçalanmıyor: isteğe bağlı alanlar varken
      // parçalama TypeScript'in tip çıkarımını bozuyor (bkz. CLAUDE.md > AI SDK v7 notları)
      execute: async (input) => {
        const task = createTask({
          title: input.baslik,
          notes: input.aciklama ?? '',
          dueDate: input.sonTarih ? parseLocalDate(input.sonTarih) : null,
          dueTime: input.saat ?? null
        })
        notifyDataChanged('tasks')
        return { id: task.id, baslik: task.title, sonTarih: task.dueDate, saat: task.dueTime }
      }
    }),

    gorevleri_listele: tool({
      description: 'Kullanıcının görevlerini listeler.',
      inputSchema: z.object({
        durum: z
          .enum(['bekleyen', 'tamamlanan', 'hepsi'])
          .optional()
          .describe('Varsayılan: bekleyen')
      }),
      execute: async ({ durum = 'bekleyen' }) => {
        const tasks = listTasks().filter((task) => {
          if (durum === 'hepsi') return true
          return durum === 'bekleyen' ? task.doneAt === null : task.doneAt !== null
        })
        return {
          gorevler: tasks.slice(0, 50).map((task) => ({
            id: task.id,
            baslik: task.title,
            sonTarih: task.dueDate,
            saat: task.dueTime,
            tamamlandi: task.doneAt !== null
          }))
        }
      }
    }),

    gorev_tamamla: tool({
      description:
        'Bir görevi tamamlandı olarak işaretler. Görevin id numarasını bilmiyorsan önce gorevleri_listele aracını kullan.',
      inputSchema: z.object({
        id: z.number().int().describe('Görev numarası')
      }),
      execute: async ({ id }) => {
        const task = updateTask(id, { done: true })
        notifyDataChanged('tasks')
        return { id: task.id, baslik: task.title, tamamlandi: true }
      }
    })
  }
}

export default taskTools
