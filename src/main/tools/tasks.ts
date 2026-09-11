import { tool } from 'ai'
import { z } from 'zod'
import { createTask, listTasks, updateTask } from '../data/tasks'
import { notifyDataChanged } from '../events'
import { parseLocalDate } from '../lib/datetime'
import type { ToolModule } from './types'

const taskTools: ToolModule = {
  labels: {
    gorev_ekle: 'Görev ekleme',
    gorevleri_listele: 'Görev listesi',
    gorev_tamamla: 'Görev tamamlama'
  },
  tools: {
    gorev_ekle: tool({
      description: 'Kullanıcının yapılacaklar listesine yeni bir görev ekler.',
      inputSchema: z.object({
        baslik: z.string().describe('Görevin kısa başlığı, ör. "Market alışverişi"'),
        sonTarih: z
          .string()
          .optional()
          .describe(
            'SADECE kullanıcı bir gün söylediyse doldur, YYYY-MM-DD biçiminde. Gün söylenmediyse bu alanı hiç gönderme.'
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
          dueDate: input.sonTarih ? parseLocalDate(input.sonTarih) : null
        })
        notifyDataChanged('tasks')
        return { id: task.id, baslik: task.title, sonTarih: task.dueDate }
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
