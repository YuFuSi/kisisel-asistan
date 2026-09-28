import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, getDb, initDatabase } from '../db'
import { addMessage, createConversation } from '../data/conversations'
import { upsertDigest } from '../data/digests'
import { createMemory, insertMemory } from '../data/memories'
import { formatRecall } from '../lib/recallFormat'
import { embedText } from './embeddings'
import { searchPastConversations } from './pastSearch'
import { recallFor } from './recall'

vi.mock('./embeddings', () => ({ embedText: vi.fn() }))
const mockEmbed = vi.mocked(embedText)

beforeEach(() => {
  initDatabase(':memory:')
  mockEmbed.mockReset()
  mockEmbed.mockRejectedValue(new Error('Ollama yok'))
})
afterEach(() => closeDb())

function digestFor(summary: string, endedAt: string): number {
  const conversation = createConversation()
  const message = addMessage(conversation.id, 'user', summary)
  upsertDigest({
    conversationId: conversation.id,
    summary,
    processedUntil: message.id,
    startedAt: endedAt,
    endedAt
  })
  return conversation.id
}

describe('recallFor', () => {
  it('az kayıtta hepsini, profili ayrı verir ve kullanıldı işaretler', async () => {
    const name = insertMemory('Kullanıcının adı Yusuf.', { kind: 'profil' })
    createMemory('Kullanıcı kahveyi sütsüz içer.')
    const recall = await recallFor('merhaba')
    expect(recall.profile.map((m) => m.content)).toEqual(['Kullanıcının adı Yusuf.'])
    expect(recall.relevant.map((m) => m.content)).toEqual(['Kullanıcı kahveyi sütsüz içer.'])
    const row = getDb().prepare('SELECT last_used_at FROM memories WHERE id = ?').get(name.id) as {
      last_used_at: string | null
    }
    expect(row.last_used_at).not.toBeNull()
  })

  it('başka sohbetlerin en son iki özetini eskiden yeniye verir, kendi sohbetini değil', async () => {
    digestFor('Eski konu', '2026-09-20 10:00:00')
    digestFor('Orta konu', '2026-09-22 10:00:00')
    const own = digestFor('Bu sohbet', '2026-09-25 10:00:00')
    const recall = await recallFor('selam', own)
    expect(recall.episodes.map((e) => e.summary)).toEqual(['Eski konu', 'Orta konu'])
  })

  it('embedding servisi yoksa bile hata vermez', async () => {
    for (let i = 0; i < 25; i++) createMemory(`Kullanıcı bilgi numarası ${i} hakkında konuştu`)
    const recall = await recallFor('bilgi numarası 3')
    expect(recall.relevant.length).toBeLessThanOrEqual(12)
  })
})

describe('formatRecall', () => {
  const now = new Date(2026, 8, 28, 12)

  it('olay ve plana öğrenildiği günü ekler, diğerlerine eklemez', () => {
    const lines = formatRecall(
      {
        profile: [],
        relevant: [
          {
            id: 1,
            content: 'Kullanıcının annesinin doğum günü Cuma.',
            createdAt: '2026-09-28 09:00:00',
            kind: 'olay',
            source: 'otomatik',
            sourceConversationId: null,
            reviewed: false
          },
          {
            id: 2,
            content: 'Kullanıcı kahveyi sütsüz içer.',
            createdAt: '2026-09-28 09:00:00',
            kind: 'tercih',
            source: 'otomatik',
            sourceConversationId: null,
            reviewed: false
          }
        ],
        episodes: []
      },
      now
    )
    expect(lines).toContain(
      '- [28 Eylül tarihinde öğrenildi] Kullanıcının annesinin doğum günü Cuma.'
    )
    expect(lines).toContain('- Kullanıcı kahveyi sütsüz içer.')
  })

  it('geçmiş konuşmaları tarihiyle ve gecmiste_ara ipucuyla verir; boşsa hiçbir şey eklemez', () => {
    const lines = formatRecall(
      {
        profile: [],
        relevant: [],
        episodes: [{ summary: 'İş ilanı konuşuldu.', endedAt: '2026-09-25 18:08:11' }]
      },
      now
    )
    expect(lines.join('\n')).toContain('- 25 Eylül: İş ilanı konuşuldu.')
    expect(lines.join('\n')).toContain('gecmiste_ara')
    expect(formatRecall({ profile: [], relevant: [], episodes: [] }, now)).toEqual([])
  })
})

describe('searchPastConversations', () => {
  it('embedding yokken kelimeyle bulur ve özeti döndürür', async () => {
    const id = digestFor('Kullanıcı iş ilanı aramak istedi.', '2026-09-25 18:00:00')
    addMessage(id, 'user', 'Akşam 9da iş ilanı bakalım')
    const hits = await searchPastConversations('iş ilanı')
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ ozet: 'Kullanıcı iş ilanı aramak istedi.' })
  })

  it('özetlerde anlam benzerliğiyle bulur', async () => {
    mockEmbed.mockImplementation(async (text) =>
      text.includes('kariyer') || text.includes('iş')
        ? new Float32Array([1, 0])
        : new Float32Array([0, 1])
    )
    digestFor('Kullanıcı iş ilanlarına bakmak istedi.', '2026-09-25 18:00:00')
    digestFor('Hava durumu soruldu.', '2026-09-26 18:00:00')
    // Özetlerin embedding'i: test için elle yazılır
    const { setDigestEmbedding, listDigestsWithEmbeddings } = await import('../data/digests')
    const { floatsToBlob } = await import('../lib/embeddingBlob')
    for (const d of listDigestsWithEmbeddings()) {
      setDigestEmbedding(d.conversationId, floatsToBlob(await embedText(d.summary)))
    }
    const hits = await searchPastConversations('kariyer')
    expect(hits.map((h) => h.ozet)).toEqual(['Kullanıcı iş ilanlarına bakmak istedi.'])
  })
})
