import { tool } from 'ai'
import { z } from 'zod'
import { createAutomation, deleteAutomation, listAutomations } from '../data/automations'
import { REPEAT_LABELS } from '../../shared/api'
import { notifyDataChanged } from '../events'
import { parseClockTime } from '../lib/brief'
import { formatDateTimeTr, parseLocalDateTime } from '../lib/datetime'
import { parseRepeatInput, simplify } from '../lib/repeat'
import type { RoutineAllowance } from '../../shared/api'
import type { ToolModule } from './types'

// Verilen adlardan ilk dolu metin alanını döndürür (modelin farklı alan adı kullanmasına karşı)
function firstString(input: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return undefined
}

const pad = (n: number): string => String(n).padStart(2, '0')

// Modelden gelen saati "HH:mm" gündelik saatine çevirir; tam tarih-saat verilirse sadece saati alınır
function parseTimeOfDay(value: string): string | null {
  const minutes = parseClockTime(value)
  if (minutes !== null) return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
  const full = parseLocalDateTime(value)
  if (!full) return null
  return `${pad(full.getHours())}:${pad(full.getMinutes())}`
}

const ALLOWANCE_ALIASES: Record<string, RoutineAllowance> = {
  '': 'none',
  yok: 'none',
  'salt okunur': 'none',
  none: 'none',
  yaz: 'write',
  yazma: 'write',
  degisiklik: 'write',
  write: 'write',
  tam: 'all',
  hepsi: 'all',
  'tam izin': 'all',
  all: 'all'
}

// Belirsiz/anlaşılmayan izin değeri en güvenli seçeneğe (none) düşer, asla en izinliye değil
function parseAllowanceInput(value: string | undefined): RoutineAllowance {
  return ALLOWANCE_ALIASES[simplify(value ?? '')] ?? 'none'
}

const automationTools: ToolModule = {
  risks: { rutin_olustur: 'write', rutinleri_listele: 'read', rutin_iptal: 'write' },
  labels: {
    rutin_olustur: 'Rutin oluşturma',
    rutinleri_listele: 'Rutin listesi',
    rutin_iptal: 'Rutin iptali'
  },
  tools: {
    rutin_olustur: tool({
      description:
        'Kullanıcının kendiliğinden, belirli bir saatte (tekrarlı veya tek seferlik) çalışacak bir rutin kurar. ' +
        'Rutin, verdiğin talimatı o saat geldiğinde asistana normal bir istek gibi verir; asistan kendi araçlarını ' +
        'kullanarak işi yapar. Basit "şunu hatırlat" istekleri için bunun yerine hatirlatma_kur kullan.',
      // Küçük modeller alan adlarını Türkçeleştirebilir veya izin seviyesini farklı yazabilir;
      // şema esnek tutulur, değerler execute içinde toparlanır.
      inputSchema: z.looseObject({
        ad: z
          .string()
          .optional()
          .describe('Rutinin kısa adı, ör. "Sabah özeti". Boş bırakılırsa talimattan türetilir.'),
        talimat: z
          .string()
          .optional()
          .describe(
            'Rutin çalışınca asistana verilecek talimat, ör. "Günlük özetimi hazırla ve sesli oku".'
          ),
        saat: z
          .string()
          .optional()
          .describe('Rutinin çalışacağı yerel saat, HH:mm biçiminde, ör. 09:00.'),
        tekrar: z
          .string()
          .optional()
          .describe(
            'SADECE kullanıcı tekrar istediyse doldur: her_gun, hafta_ici veya her_hafta. Tek seferlik rutinde boş bırak.'
          ),
        izin: z
          .string()
          .optional()
          .describe(
            'SADECE kullanıcı açıkça söylediyse doldur: "salt okunur" (varsayılan, hiçbir değişiklik yapmaz), ' +
              '"yaz" (uygulama içi değişiklikleri onaysız yapar) veya "tam" (tehlikeli işlemleri de onaysız yapar). ' +
              'Belirsizse hiç doldurma; en güvenli seçenek kullanılır.'
          )
      }),
      execute: async (input) => {
        const raw = input as Record<string, unknown>
        const prompt = firstString(raw, ['talimat', 'prompt', 'gorev', 'yapilacak'])
        if (!prompt) throw new Error('Rutinin ne yapacağı (talimat) eksik.')

        const when = firstString(raw, ['saat', 'zaman', 'time'])
        if (!when)
          throw new Error('Rutinin çalışma saati (saat) eksik. HH:mm biçiminde yaz, ör. 09:00.')
        const timeOfDay = parseTimeOfDay(when)
        if (!timeOfDay) throw new Error('Saat SS:DD biçiminde olmalı, ör. 09:00.')

        const repeat = parseRepeatInput(firstString(raw, ['tekrar', 'repeat']))
        const allowance = parseAllowanceInput(firstString(raw, ['izin', 'allowance']))
        const name = firstString(raw, ['ad', 'isim', 'name']) ?? prompt.slice(0, 60)

        const automation = createAutomation({ name, prompt, timeOfDay, repeat, allowance })
        notifyDataChanged('automations')
        return {
          id: automation.id,
          ad: automation.name,
          saat: automation.timeOfDay,
          tekrar: REPEAT_LABELS[automation.repeat],
          izin: automation.allowance,
          sonrakiCalisma: formatDateTimeTr(new Date(automation.nextRunAt))
        }
      }
    }),

    rutinleri_listele: tool({
      description: 'Kullanıcının kurduğu rutinleri listeler.',
      inputSchema: z.object({}),
      execute: async () => ({
        rutinler: listAutomations().map((automation) => ({
          id: automation.id,
          ad: automation.name,
          talimat: automation.prompt,
          saat: automation.timeOfDay,
          tekrar: REPEAT_LABELS[automation.repeat],
          izin: automation.allowance,
          acik: automation.enabled,
          sonrakiCalisma: formatDateTimeTr(new Date(automation.nextRunAt))
        }))
      })
    }),

    rutin_iptal: tool({
      description:
        'Bir rutini kalıcı olarak siler. id numarasını bilmiyorsan önce rutinleri_listele aracını kullan.',
      inputSchema: z.object({
        id: z.number().int().describe('Rutin numarası')
      }),
      execute: async ({ id }) => {
        deleteAutomation(id)
        notifyDataChanged('automations')
        return { id, iptalEdildi: true }
      }
    })
  }
}

export default automationTools
