import { describe, expect, it } from 'vitest'
import type { Conversation, ConversationSearchResult } from '@shared/api'
import { groupConversations, parseSqliteUtc } from './conversationGroups'

function result(over: Partial<Conversation> = {}): ConversationSearchResult {
  return {
    conversation: {
      id: 1,
      title: 'Sohbet',
      updatedAt: '2026-09-22 09:00:00',
      pinned: false,
      ...over
    },
    snippet: null
  }
}

const now = new Date('2026-09-22T12:00:00Z')

describe('parseSqliteUtc', () => {
  it('boşlukla ayrılmış SQLite dizgesini UTC olarak ayrıştırır', () => {
    expect(parseSqliteUtc('2026-09-22 09:00:00').toISOString()).toBe('2026-09-22T09:00:00.000Z')
  })
})

describe('groupConversations', () => {
  it('sabitlenen sohbeti tarihinden bağımsız "Sabitli" grubuna koyar', () => {
    const groups = groupConversations(
      [result({ id: 1, pinned: true, updatedAt: '2026-08-01 00:00:00' })],
      now
    )
    expect(groups.map((g) => g.label)).toEqual(['Sabitli'])
  })

  it('bugün güncellenen sohbeti "Bugün" grubuna koyar', () => {
    const groups = groupConversations([result({ updatedAt: '2026-09-22 09:00:00' })], now)
    expect(groups.map((g) => g.label)).toEqual(['Bugün'])
  })

  it('dün güncellenen sohbeti "Dün" grubuna koyar', () => {
    const groups = groupConversations([result({ updatedAt: '2026-09-21 09:00:00' })], now)
    expect(groups.map((g) => g.label)).toEqual(['Dün'])
  })

  it('2-6 gün önceyi "Bu hafta" grubuna koyar', () => {
    const groups = groupConversations([result({ updatedAt: '2026-09-18 09:00:00' })], now)
    expect(groups.map((g) => g.label)).toEqual(['Bu hafta'])
  })

  it('6 günden eskiyi "Daha eski" grubuna koyar', () => {
    const groups = groupConversations([result({ updatedAt: '2026-09-10 09:00:00' })], now)
    expect(groups.map((g) => g.label)).toEqual(['Daha eski'])
  })

  it('boş grupları döndürmez ve sırayı korur', () => {
    const groups = groupConversations(
      [
        result({ id: 1, updatedAt: '2026-09-10 09:00:00' }),
        result({ id: 2, pinned: true, updatedAt: '2026-09-22 09:00:00' })
      ],
      now
    )
    expect(groups.map((g) => g.label)).toEqual(['Sabitli', 'Daha eski'])
  })
})
