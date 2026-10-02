import type { SettingsView } from '@shared/api'

// Sohbet cevabını balona sığacak düz metne çevirir.
export function bubbleText(markdown: string, max = 280): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' (kod) ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= max) return plain
  const cut = plain.slice(0, max)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : max)}…`
}

export function inQuietHours(
  settings: Pick<SettingsView, 'quietStart' | 'quietEnd'> | null,
  now = new Date()
): boolean {
  if (!settings?.quietStart || !settings.quietEnd) return false
  const minutes = now.getHours() * 60 + now.getMinutes()
  const toMinutes = (value: string): number => {
    const [h, m] = value.split(':').map(Number)
    return h * 60 + m
  }
  const start = toMinutes(settings.quietStart)
  const end = toMinutes(settings.quietEnd)
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}
