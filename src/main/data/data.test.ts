import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDatabase } from '../db'
import { addMessage, createConversation, listMessages } from './conversations'
import { createMemory, listMemories } from './memories'
import { createNote, searchNotes, updateNote } from './notes'
import { createReminder, listPendingReminders, takeDueReminders } from './reminders'
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
