// Uygulama genelinde tekrarlanan durum seviyesi: ok/warn/bad/unknown + devam eden bir şey için "active"
export type Level = 'ok' | 'warn' | 'bad' | 'unknown' | 'active'

export const LEVEL_DOT_CLASS: Record<Level, string> = {
  ok: 'bg-positive',
  warn: 'bg-caution',
  bad: 'bg-negative',
  unknown: 'bg-faint',
  active: 'bg-glow'
}

export const LEVEL_TEXT_CLASS: Record<Level, string> = {
  ok: 'text-positive',
  warn: 'text-caution',
  bad: 'text-negative',
  unknown: 'text-faint',
  active: 'text-glow'
}
