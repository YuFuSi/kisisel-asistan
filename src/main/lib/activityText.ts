const SUMMARY_LIMIT = 120

/**
 * Araç girdisinden etkinlik kaydı için kısa açıklama çıkarır.
 * { baslik: 'Süt al', tarih: '2026-09-15' } → "Süt al · 2026-09-15"
 */
export function describeToolInput(input: unknown): string {
  let text = ''
  if (typeof input === 'string' || typeof input === 'number') {
    text = String(input)
  } else if (input && typeof input === 'object') {
    text = Object.values(input)
      .filter((value) => typeof value === 'string' || typeof value === 'number')
      .map((value) => String(value).replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' · ')
  }
  return text.length > SUMMARY_LIMIT ? `${text.slice(0, SUMMARY_LIMIT - 1)}…` : text
}
