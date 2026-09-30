import { REPEAT_LABELS, type ToolCard } from '../../shared/api'

// Bağlamsal kartlar: bazı araçların ham sonucundan arayüzde gösterilecek yapılandırılmış kart
// üretir. Modele giden kısaltılmış metin sonuçtan bağımsızdır; alanlar tek tek doğrulanır, beklenen
// biçimde olmayan sonuçtan kart çıkmaz (arayüz sadece küçük etiketi gösterir).

const MAX_ITEMS = 5

type Row = Record<string, unknown>

const isRow = (value: unknown): value is Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null
const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null
const rows = (value: unknown): Row[] => (Array.isArray(value) ? value.filter(isRow) : [])

function weatherCard(output: Row): ToolCard | null {
  const now = isRow(output.simdi) ? output.simdi : null
  const place = str(output.yer)
  const temperature = num(now?.sicaklik)
  const condition = str(now?.durum)
  if (!place || temperature === null || !condition) return null
  const days = rows(output.gunler)
    .map((day) => ({
      day: str(day.gun) ?? '',
      min: num(day.enDusuk),
      max: num(day.enYuksek),
      rainChance: num(day.yagisIhtimali)
    }))
    .filter(
      (day): day is { day: string; min: number; max: number; rainChance: number | null } =>
        Boolean(day.day) && day.min !== null && day.max !== null
    )
    .slice(0, MAX_ITEMS)
  return { kind: 'weather', place: place.split(',')[0], temperature, condition, days }
}

function eventsCard(output: Row): ToolCard | null {
  const items = rows(output.etkinlikler)
    .map((event) => ({
      title: str(event.baslik) ?? '(başlıksız)',
      time: str(event.baslangic) ?? '',
      location: str(event.konum)
    }))
    .slice(0, MAX_ITEMS)
  // Boş liste de anlamlıdır ("bugün etkinlik yok"), kart yine gösterilir
  return Array.isArray(output.etkinlikler) ? { kind: 'events', items } : null
}

function filesCard(output: Row): ToolCard | null {
  if (!Array.isArray(output.dosyalar)) return null
  const all = rows(output.dosyalar)
  const items = all
    .map((file) => ({
      name: str(file.ad) ?? '',
      path: str(file.yol) ?? '',
      sizeKb: num(file.boyutKb) ?? 0
    }))
    .filter((file) => file.name && file.path)
    .slice(0, MAX_ITEMS)
  return { kind: 'files', total: num(output.bulunan) ?? all.length, items }
}

function taskCard(output: Row): ToolCard | null {
  const title = str(output.baslik)
  if (!title) return null
  const date = str(output.sonTarih)
  const time = str(output.saat)
  return { kind: 'task', title, due: date ? (time ? `${date} ${time}` : date) : null }
}

function reminderCard(output: Row): ToolCard | null {
  const message = str(output.mesaj)
  const when = str(output.zaman)
  if (!message || !when) return null
  const repeat = str(output.tekrar)
  return {
    kind: 'reminder',
    message,
    when,
    repeat: repeat && repeat !== REPEAT_LABELS.none ? repeat : null
  }
}

const BUILDERS: Record<string, (output: Row) => ToolCard | null> = {
  hava_durumu: weatherCard,
  takvim_listele: eventsCard,
  dosya_bul: filesCard,
  gorev_ekle: taskCard,
  hatirlatma_kur: reminderCard
}

/** Aracın sonucundan kart üretir; bu araç için kart yoksa veya sonuç beklenmedikse null */
export function buildToolCard(toolName: string, output: unknown): ToolCard | null {
  const builder = BUILDERS[toolName]
  if (!builder || !isRow(output)) return null
  try {
    return builder(output)
  } catch {
    return null
  }
}
