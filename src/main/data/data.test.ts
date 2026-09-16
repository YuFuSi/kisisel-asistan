import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDatabase } from '../db'
import {
  addMessage,
  clearGeneratedTitle,
  createConversation,
  deleteMessagesFrom,
  getConversation,
  listConversations,
  listMessages,
  renameConversation,
  searchConversations,
  setConversationPinned,
  setGeneratedTitle,
  setTitleIfEmpty
} from './conversations'
import {
  createMemory,
  listMemories,
  listMemoriesMissingEmbedding,
  setMemoryEmbedding
} from './memories'
import { createNote, searchNotes, updateNote } from './notes'
import { createReminder, listPendingReminders, snoozeReminder, takeDueReminders } from './reminders'
import { createTask, listTasks, updateTask } from './tasks'

// Her test boş, bellekte çalışan bir veritabanıyla başlar
beforeEach(() => initDatabase(':memory:'))
afterEach(() => closeDb())

describe('görevler', () => {
  it('ekler, sıralar ve tamamlar', () => {
    const market = createTask({ title: '  Market  ' })
    const fatura = createTask({ title: 'Fatura öde', dueDate: '2026-09-15' })
    expect(market.title).toBe('Market')

    // Tarihli görev tarihsizden önce gelir
    expect(listTasks().map((t) => t.id)).toEqual([fatura.id, market.id])

    const done = updateTask(fatura.id, { done: true })
    expect(done.doneAt).not.toBeNull()
    // Tamamlanan görev sona geçer
    expect(listTasks().map((t) => t.id)).toEqual([market.id, fatura.id])

    expect(updateTask(fatura.id, { done: false }).doneAt).toBeNull()
  })

  it('geçersiz girdiyi reddeder', () => {
    expect(() => createTask({ title: '   ' })).toThrow()
    expect(() => createTask({ title: 'Test', dueDate: '15.09.2026' })).toThrow()
    expect(() => updateTask(999, { done: true })).toThrow()
  })

  it('saatli görevi kabul eder, saat için tarih şartını ve biçimini denetler', () => {
    const toplanti = createTask({ title: 'Toplantı', dueDate: '2026-09-15', dueTime: '14:00' })
    expect(toplanti.dueTime).toBe('14:00')

    expect(() => createTask({ title: 'Tarihsiz saatli', dueTime: '14:00' })).toThrow()
    expect(() =>
      createTask({ title: 'Yanlış saat', dueDate: '2026-09-15', dueTime: '25:00' })
    ).toThrow()

    // Tarih kaldırılınca eski saat de düşer
    const updated = updateTask(toplanti.id, { dueDate: null })
    expect(updated.dueTime).toBeNull()
  })
})

describe('hatırlatmalar', () => {
  it('zamanı geleni bir kez verir, gelmeyeni bekletir', () => {
    const now = Date.now()
    const gecmis = createReminder('Doktoru ara', now - 1000)
    createReminder('Toplantı', now + 60_000)

    expect(takeDueReminders(now).map((r) => r.id)).toEqual([gecmis.id])
    expect(takeDueReminders(now)).toEqual([])
    expect(listPendingReminders().map((r) => r.message)).toEqual(['Toplantı'])
  })

  it('boş metni reddeder', () => {
    expect(() => createReminder('  ', Date.now())).toThrow()
  })
})

describe('notlar', () => {
  it('Türkçe büyük/küçük harfe duyarsız arar', () => {
    createNote({ title: 'İstanbul gezisi', content: 'Şişli ve Kadıköy' })
    createNote({ title: 'Alışveriş', content: 'ekmek, SÜT' })

    expect(searchNotes('istanbul').map((n) => n.title)).toEqual(['İstanbul gezisi'])
    expect(searchNotes('ŞİŞLİ kadıköy')).toHaveLength(1)
    expect(searchNotes('süt')).toHaveLength(1)
    expect(searchNotes('ankara')).toHaveLength(0)
  })

  it('günceller', () => {
    const note = createNote({ title: 'Fikirler' })
    expect(updateNote(note.id, { content: 'Uygulama' })).toMatchObject({
      title: 'Fikirler',
      content: 'Uygulama'
    })
  })
})

describe('hafıza', () => {
  it('aynı bilgiyi iki kez kaydetmez', () => {
    createMemory('Kahvesini şekersiz içer')
    createMemory('  KAHVESİNİ ŞEKERSİZ İÇER ')
    expect(listMemories()).toHaveLength(1)
  })

  it("yeni kayıtların embedding'i başta eksik sayılır", () => {
    const memory = createMemory('Kahvesini şekersiz içer')
    expect(listMemoriesMissingEmbedding().map((m) => m.id)).toContain(memory.id)
  })

  it('embedding yazılınca eksik listesinden çıkar', () => {
    const memory = createMemory('Kahvesini şekersiz içer')
    setMemoryEmbedding(memory.id, Buffer.from(new Float32Array([1, 2, 3]).buffer))
    expect(listMemoriesMissingEmbedding().map((m) => m.id)).not.toContain(memory.id)
  })
})

describe('sohbet mesajları', () => {
  it('araç etkinliklerini saklar', () => {
    const conversation = createConversation()
    addMessage(conversation.id, 'assistant', 'Görevi ekledim', [
      { id: 'call-1', name: 'gorev_ekle', label: 'Görev ekleme', status: 'done' }
    ])
    const [message] = listMessages(conversation.id)
    expect(message.tools).toEqual([
      { id: 'call-1', name: 'gorev_ekle', label: 'Görev ekleme', status: 'done' }
    ])
  })
})

describe('sohbet listesi', () => {
  it('sabitlenen sohbeti başa alır', () => {
    const eski = createConversation()
    const yeni = createConversation()
    expect(listConversations().map((c) => c.id)).toEqual([yeni.id, eski.id])

    expect(setConversationPinned(eski.id, true).pinned).toBe(true)
    expect(listConversations().map((c) => c.id)).toEqual([eski.id, yeni.id])

    setConversationPinned(eski.id, false)
    expect(listConversations().map((c) => c.id)).toEqual([yeni.id, eski.id])
  })

  it('başlığı kırpar ve boş başlığı reddeder', () => {
    const conversation = createConversation()
    expect(renameConversation(conversation.id, '  Tatil   planı  ').title).toBe('Tatil planı')
    expect(() => renameConversation(conversation.id, '   ')).toThrow()
  })

  it('başlıkta ve mesajlarda Türkçe duyarlı arar', () => {
    const ilk = createConversation()
    renameConversation(ilk.id, 'Kahve tarifleri')
    const ikinci = createConversation()
    addMessage(ikinci.id, 'user', 'IZMIR hava durumu nasıl?')

    expect(searchConversations('kahve').map((r) => r.conversation.id)).toEqual([ilk.id])
    // "IZMIR" hem "izmir" hem "ızmır" yazımıyla bulunmalı
    expect(searchConversations('izmir')[0].conversation.id).toBe(ikinci.id)
    expect(searchConversations('ızmır')[0].conversation.id).toBe(ikinci.id)
    expect(searchConversations('izmir')[0].snippet).toContain('IZMIR')
    expect(searchConversations('bulunmayan')).toEqual([])
    // Boş arama tüm sohbetleri döndürür
    expect(searchConversations('  ')).toHaveLength(2)
  })

  it('bir mesajdan sonrasını siler', () => {
    const conversation = createConversation()
    addMessage(conversation.id, 'user', 'Merhaba')
    const ikinci = addMessage(conversation.id, 'assistant', 'Selam')
    addMessage(conversation.id, 'user', 'Nasılsın?')

    deleteMessagesFrom(conversation.id, ikinci.id)
    expect(listMessages(conversation.id).map((m) => m.content)).toEqual(['Merhaba'])
  })
})

describe('sohbet başlığı', () => {
  it('modelin başlığı kullanıcının verdiği adı ezmez', () => {
    const otomatik = createConversation()
    setTitleIfEmpty(otomatik.id, 'Kahve nasıl demlenir')
    setGeneratedTitle(otomatik.id, 'Kahve demleme')
    expect(getConversation(otomatik.id)?.title).toBe('Kahve demleme')

    const elle = createConversation()
    renameConversation(elle.id, 'Benim sohbetim')
    setGeneratedTitle(elle.id, 'Model başlığı')
    expect(getConversation(elle.id)?.title).toBe('Benim sohbetim')
  })

  it('otomatik başlık sıfırlanır, kullanıcının adı korunur', () => {
    const otomatik = createConversation()
    setTitleIfEmpty(otomatik.id, 'Bir soru')
    clearGeneratedTitle(otomatik.id)
    expect(getConversation(otomatik.id)?.title).toBe('')

    const elle = createConversation()
    renameConversation(elle.id, 'Benim sohbetim')
    clearGeneratedTitle(elle.id)
    expect(getConversation(elle.id)?.title).toBe('Benim sohbetim')
  })
})

describe('tekrarlayan hatırlatmalar', () => {
  it('çaldıktan sonra bir sonraki güne atılır, silinmez', () => {
    const now = Date.now()
    const gunluk = createReminder('Vitamin al', now - 1000, 'daily')
    expect(gunluk.repeat).toBe('daily')

    const due = takeDueReminders(now)
    expect(due.map((r) => r.id)).toEqual([gunluk.id])

    // Hâlâ bekleyenler arasında ve zamanı ileri alınmış
    const pending = listPendingReminders()
    expect(pending).toHaveLength(1)
    expect(pending[0].remindAt).toBeGreaterThan(now)
    // İkinci kontrolde tekrar çalmaz
    expect(takeDueReminders(now)).toEqual([])
  })

  it('tek seferlik hatırlatma çaldıktan sonra listeden çıkar', () => {
    const now = Date.now()
    createReminder('Doktoru ara', now - 1000)
    expect(takeDueReminders(now)).toHaveLength(1)
    expect(listPendingReminders()).toEqual([])
  })

  it('erteleme zamanı ileri alır ve hatırlatmayı geri getirir', () => {
    const now = Date.now()
    const reminder = createReminder('Çamaşır', now - 1000)
    takeDueReminders(now)
    expect(listPendingReminders()).toEqual([])

    const snoozed = snoozeReminder(reminder.id, 10, now)
    expect(snoozed.remindAt).toBe(now + 10 * 60_000)
    expect(listPendingReminders().map((r) => r.id)).toEqual([reminder.id])
    expect(() => snoozeReminder(reminder.id, 0, now)).toThrow()
  })
})
