import type { ChatMessage, Conversation } from '../../shared/api'

/** Sohbeti okunabilir bir Markdown belgesine çevirir */
export function conversationToMarkdown(
  conversation: Conversation,
  messages: ChatMessage[]
): string {
  const lines: string[] = [`# ${conversation.title || 'Sohbet'}`, '']

  for (const message of messages) {
    lines.push(message.role === 'user' ? '## Sen' : '## Asistan')
    if (message.tools.length > 0) {
      lines.push(`> Kullanılan araçlar: ${message.tools.map((tool) => tool.label).join(', ')}`, '')
    }
    lines.push(message.content.trim() || '_(boş cevap)_', '')
  }

  return lines.join('\n').trimEnd() + '\n'
}

const TURKISH_MAP: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u'
}

/** Dosya adı için güvenli, Türkçe karakterleri sadeleştirilmiş bir ad üretir */
export function suggestFileName(conversation: Conversation): string {
  const base = (conversation.title || 'sohbet')
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (char) => TURKISH_MAP[char] ?? char)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
  return `${base || 'sohbet'}.md`
}
