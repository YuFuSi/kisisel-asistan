import { beforeEach, describe, expect, it } from 'vitest'
import { getDb, initDatabase } from '../db'
import { addMessage, createConversation, deleteConversation } from './conversations'
import {
  getDigest,
  listConversationsPendingDigest,
  markDigestProcessed,
  upsertDigest
} from './digests'
import {
  createMemory,
  deleteMemory,
  insertMemory,
  listMemories,
  listUnreviewedMemories,
  markMemoriesReviewed,
  markMemoriesUsed,
  normalizeMemoryKind,
  setMemoryKind
} from './memories'

beforeEach(() => initDatabase(':memory:'))

// Mesajları geçmişe tarihler (konuşma "bitmiş" sayılsın)
function ageMessages(conversationId: number, minutes: number): void {
  getDb()
    .prepare(`UPDATE messages SET created_at = datetime('now', ?) WHERE conversation_id = ?`)
    .run(`-${minutes} minutes`, conversationId)
}

describe('hafıza türü ve kaynağı', () => {
  it('eski yoldan (araç) kaydedilen bilgi varsayılan tür ve gözden geçirilmiş gelir', () => {
    const memory = createMemory('Kahvesini şekersiz içer')
    expect(memory).toMatchObject({ kind: 'bilgi', source: 'arac', reviewed: true })
  })

  it('otomatik öğrenilen kayıt türü, kaynağı ve sohbetiyle, gözden geçirilmemiş gelir', () => {
    const conversation = createConversation()
    const memory = insertMemory('Adı Yusuf', {
      kind: 'profil',
      source: 'otomatik',
      sourceConversationId: conversation.id
    })
    expect(memory).toMatchObject({
      kind: 'profil',
      source: 'otomatik',
      sourceConversationId: conversation.id,
      reviewed: false
    })
    expect(listUnreviewedMemories().map((m) => m.id)).toEqual([memory.id])
  })

  it('gözden geçirme tek tek ve toplu yapılır', () => {
    const a = insertMemory('Bir', { source: 'otomatik' })
    const b = insertMemory('İki', { source: 'otomatik' })
    markMemoriesReviewed([a.id])
    expect(listUnreviewedMemories().map((m) => m.id)).toEqual([b.id])
    markMemoriesReviewed()
    expect(listUnreviewedMemories()).toEqual([])
  })

  it('sohbet silinince ondan öğrenilen bilgi kalır', () => {
    const conversation = createConversation()
    insertMemory('Kızının adı Elif', { source: 'otomatik', sourceConversationId: conversation.id })
    deleteConversation(conversation.id)
    expect(listMemories().map((m) => m.content)).toContain('Kızının adı Elif')
  })

  it('tür değiştirilebilir, kullanım zamanı işaretlenir', () => {
    const memory = createMemory('Ankara’da yaşıyor')
    setMemoryKind(memory.id, 'profil')
    markMemoriesUsed([memory.id])
    const row = getDb()
      .prepare('SELECT kind, last_used_at FROM memories WHERE id = ?')
      .get(memory.id) as { kind: string; last_used_at: string | null }
    expect(row.kind).toBe('profil')
    expect(row.last_used_at).not.toBeNull()
    deleteMemory(memory.id)
  })

  it('bilinmeyen veya Türkçe yazılmış tür adı düzgün çevrilir', () => {
    expect(normalizeMemoryKind('Kişi')).toBe('kisi')
    expect(normalizeMemoryKind('TERCİH')).toBe('tercih')
    expect(normalizeMemoryKind('saçma')).toBe('bilgi')
    expect(normalizeMemoryKind(undefined)).toBe('bilgi')
  })
})

describe('konuşma özetleri', () => {
  it('bitmiş ve işlenmemiş sohbet bekleyenler listesinde çıkar', () => {
    const conversation = createConversation()
    addMessage(conversation.id, 'user', 'Merhaba')
    const last = addMessage(conversation.id, 'assistant', 'Selam')
    // Henüz yeni: konuşma sürüyor sayılır
    expect(listConversationsPendingDigest(10)).toEqual([])
    ageMessages(conversation.id, 15)
    expect(listConversationsPendingDigest(10)).toEqual([
      { conversationId: conversation.id, lastMessageId: last.id, processedUntil: 0 }
    ])
  })

  it('işlenen sohbet, yeni mesaj gelene kadar tekrar çıkmaz', () => {
    const conversation = createConversation()
    addMessage(conversation.id, 'user', 'Merhaba')
    const last = addMessage(conversation.id, 'assistant', 'Selam')
    ageMessages(conversation.id, 15)
    upsertDigest({
      conversationId: conversation.id,
      summary: 'Selamlaştılar',
      processedUntil: last.id,
      startedAt: '2026-09-28 10:00:00',
      endedAt: '2026-09-28 10:01:00'
    })
    expect(listConversationsPendingDigest(10)).toEqual([])

    const next = addMessage(conversation.id, 'user', 'Yarın toplantım var')
    ageMessages(conversation.id, 15)
    expect(listConversationsPendingDigest(10)).toEqual([
      { conversationId: conversation.id, lastMessageId: next.id, processedUntil: last.id }
    ])
    markDigestProcessed(conversation.id, next.id)
    expect(listConversationsPendingDigest(10)).toEqual([])
    expect(getDigest(conversation.id)?.summary).toBe('Selamlaştılar')
  })

  it('sohbet silinince özeti de silinir', () => {
    const conversation = createConversation()
    const message = addMessage(conversation.id, 'user', 'Merhaba')
    upsertDigest({
      conversationId: conversation.id,
      summary: 'x',
      processedUntil: message.id,
      startedAt: 'a',
      endedAt: 'b'
    })
    deleteConversation(conversation.id)
    expect(getDigest(conversation.id)).toBeNull()
  })
})
