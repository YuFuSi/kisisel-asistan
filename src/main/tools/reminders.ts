import { tool } from 'ai'
import { z } from 'zod'
import { createReminder, deleteReminder, listPendingReminders } from '../data/reminders'
import { REPEAT_LABELS } from '../../shared/api'
import { notifyDataChanged } from '../events'
import { formatDateTimeTr } from '../lib/datetime'
import { parseRepeatInput, resolveReminderTime } from '../lib/repeat'
import type { ToolModule } from './types'

// Verilen adlardan ilk dolu metin alanını döndürür (modelin farklı alan adı kullanmasına karşı)
function firstString(input: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return undefined
}

const reminderTools: ToolModule = {
  risks: { hatirlatma_kur: 'write', hatirlatmalari_listele: 'read', hatirlatma_iptal: 'write' },
  labels: {
    hatirlatma_kur: 'Hatırlatma kurma',
    hatirlatmalari_listele: 'Hatırlatma listesi',
    hatirlatma_iptal: 'Hatırlatma iptali'
  },
  tools: {
    hatirlatma_kur: tool({
      description:
        'Belirtilen tarih ve saatte kullanıcıya Windows bildirimiyle hatırlatma gösterir. "Yarın saat 10", "2 saat sonra" gibi ifadeleri şu anki zamana göre hesapla. "Her gün / hafta içi / her hafta" denirse tekrar alanını doldur.',
      // Küçük modeller alan adlarını bazen Türkçeleştiriyor (metin, saat) veya tekrarı "her_gun" diye
      // yazıyor. Bu yüzden şema esnek tutulur (bilinmeyen alanlar atılmaz), değerler execute içinde toparlanır.
      inputSchema: z.looseObject({
        mesaj: z
          .string()
          .optional()
          .describe(
            'Bildirimde görünecek kısa ve net metin, ör. "Doktoru ara". Kullanıcının cümlesini aynen kopyalama.'
          ),
        zaman: z
          .string()
          .optional()
          .describe(
            'İlk hatırlatmanın yerel tarih ve saati, YYYY-MM-DDTHH:mm biçiminde, ör. 2026-09-12T10:00. Tekrarlayan hatırlatmada sadece saat de yazılabilir, ör. 09:00.'
          ),
        tekrar: z
          .string()
          .optional()
          .describe(
            'SADECE kullanıcı tekrar istediyse doldur: her_gun, hafta_ici veya her_hafta. Tek seferlik hatırlatmada boş bırak.'
          )
      }),
      execute: async (input) => {
        const raw = input as Record<string, unknown>
        const message = firstString(raw, ['mesaj', 'metin', 'message', 'text'])
        const when = firstString(raw, ['zaman', 'saat', 'tarih', 'time'])
        if (!message) throw new Error('Hatırlatma metni (mesaj) eksik.')
        if (!when) {
          throw new Error(
            'Hatırlatma zamanı (zaman) eksik. YYYY-MM-DDTHH:mm veya SS:DD biçiminde yaz.'
          )
        }

        const repeat = parseRepeatInput(firstString(raw, ['tekrar', 'repeat']))
        const date = resolveReminderTime(when, repeat, Date.now())
        if (!date) {
          throw new Error(
            'Zaman YYYY-MM-DDTHH:mm (ör. 2026-09-13T09:00) veya tekrarlayan hatırlatmada SS:DD (ör. 09:00) biçiminde olmalı.'
          )
        }
        if (date.getTime() < Date.now() - 60_000) {
          throw new Error('Bu zaman geçmişte kalıyor; ileri bir zaman seç.')
        }
        const reminder = createReminder(message, date.getTime(), repeat)
        notifyDataChanged('reminders')
        return {
          id: reminder.id,
          mesaj: reminder.message,
          zaman: formatDateTimeTr(date),
          tekrar: REPEAT_LABELS[repeat]
        }
      }
    }),

    hatirlatmalari_listele: tool({
      description: 'Zamanı henüz gelmemiş hatırlatmaları listeler.',
      inputSchema: z.object({}),
      execute: async () => ({
        hatirlatmalar: listPendingReminders().map((reminder) => ({
          id: reminder.id,
          mesaj: reminder.message,
          zaman: formatDateTimeTr(new Date(reminder.remindAt)),
          tekrar: REPEAT_LABELS[reminder.repeat]
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
