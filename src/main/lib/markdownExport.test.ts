import { describe, expect, it } from 'vitest'
import { conversationToMarkdown, suggestFileName } from './markdownExport'
import type { ChatMessage, Conversation } from '../../shared/api'

const conversation: Conversation = {
  id: 1,
  title: 'Tatil planı',
  updatedAt: '2026-09-12 10:00:00',
  pinned: false
}

const message = (
  role: ChatMessage['role'],
  content: string,
  tools: ChatMessage['tools'] = []
): ChatMessage => ({
  id: 1,
  conversationId: 1,
  role,
  content,
  tools,
  createdAt: '2026-09-12 10:00:00'
})

describe('conversationToMarkdown', () => {
  it('başlık ve mesajları başlıklarla yazar', () => {
    const output = conversationToMarkdown(conversation, [
      message('user', 'Merhaba'),
      message('assistant', 'Selam, nasıl yardımcı olabilirim?')
    ])
    expect(output).toContain('# Tatil planı')
    expect(output).toContain('## Sen\nMerhaba')
    expect(output).toContain('## Asistan\nSelam, nasıl yardımcı olabilirim?')
    expect(output.endsWith('\n')).toBe(true)
  })

  it('kullanılan araçları ve boş cevabı belirtir', () => {
    const output = conversationToMarkdown(conversation, [
      message('assistant', '', [
        { id: 'a', name: 'gorev_ekle', label: 'Görev ekleme', status: 'done' }
      ])
    ])
    expect(output).toContain('> Kullanılan araçlar: Görev ekleme')
    expect(output).toContain('_(boş cevap)_')
  })
})

describe('suggestFileName', () => {
  it('Türkçe karakterleri sadeleştirir', () => {
    expect(suggestFileName({ ...conversation, title: 'Şişli gezisi çöp' })).toBe(
      'sisli-gezisi-cop.md'
    )
  })

  it('başlık yoksa varsayılan ad verir', () => {
    expect(suggestFileName({ ...conversation, title: '' })).toBe('sohbet.md')
    expect(suggestFileName({ ...conversation, title: '???' })).toBe('sohbet.md')
  })
})
