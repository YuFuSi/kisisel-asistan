import { tool } from 'ai'
import { z } from 'zod'
import { createReminder, deleteReminder, listPendingReminders } from '../data/reminders'
import { notifyDataChanged } from '../events'
import { formatDateTimeTr, parseLocalDateTime } from '../lib/datetime'
import type { ToolModule } from './types'

const reminderTools: ToolModule = {
  labels: {
    hatirlatma_kur: 'Hatırlatma kurma',
    hatirlatmalari_listele: 'Hatırlatma listesi',
    hatirlatma_iptal: 'Hatırlatma iptali'
  },
  tools: {
    hatirlatma_kur: tool({
      description:
        'Belirtilen tarih ve saatte kullanıcıya Windows bildirimiyle hatırlatma gösterir. "Yarın 10\'da", "2 saat sonra" gibi ifadeleri şu anki zamana göre hesapla.',
      inputSchema: z.object({
        mesaj: z
          .string()
          .describe(
            'Bildirimde görünecek kısa ve net metin, ör. "Doktoru ara". Kullanıcının cümlesini aynen kopyalama.'
          ),
        zaman: z
          .string()
          .describe('Yerel tarih ve saat, YYYY-MM-DDTHH:mm biçiminde, ör. 2026-09-12T10:00')
      }),
      execute: async ({ mesaj, zaman }) => {
        const date = parseLocalDateTime(zaman)
        if (!date) throw new Error('Zaman YYYY-MM-DDTHH:mm biçiminde olmalı.')
        if (date.getTime() < Date.now() - 60_000) {
          throw new Error('Bu zaman geçmişte kalıyor; ileri bir zaman seç.')
        }
        const reminder = createReminder(mesaj, date.getTime())
        notifyDataChanged('reminders')
        return { id: reminder.id, mesaj: reminder.message, zaman: formatDateTimeTr(date) }
      }
    }),

    hatirlatmalari_listele: tool({
      description: 'Zamanı henüz gelmemiş hatırlatmaları listeler.',
      inputSchema: z.object({}),
      execute: async () => ({
        hatirlatmalar: listPendingReminders().map((reminder) => ({
          id: reminder.id,
          mesaj: reminder.message,
          zaman: formatDateTimeTr(new Date(reminder.remindAt))
        }))
      })
    }),

    hatirlatma_iptal: tool({
      description:
        'Bir hatırlatmayı iptal eder. id numarasını bilmiyorsan önce hatirlatmalari_listele aracını kullan.',
      inputSchema: z.object({
        id: z.number().int().describe('Hatırlatma numarası')
      }),
      execute: async ({ id }) => {
        deleteReminder(id)
        notifyDataChanged('reminders')
        return { id, iptalEdildi: true }
      }
    })
  }
}

export default reminderTools
