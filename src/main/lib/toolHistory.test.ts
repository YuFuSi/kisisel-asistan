import { describe, expect, it } from 'vitest'
import {
  summarizeToolOutput,
  toModelMessages,
  TOOL_HISTORY_MESSAGES,
  TOOL_RESULT_LIMIT
} from './toolHistory'
import type { ChatMessage, ToolActivity } from '../../shared/api'

let nextId = 1
const message = (
  role: ChatMessage['role'],
  content: string,
  tools: ToolActivity[] = []
): ChatMessage => ({
  id: nextId++,
  conversationId: 1,
  role,
  content,
  tools,
  createdAt: '2026-09-13 10:00:00',
  outcome: null
})

const taskTool: ToolActivity = {
  id: 'call-1',
  name: 'gorev_ekle',
  label: 'Görev ekleme',
  status: 'done',
  input: { baslik: 'Market' },
  result: '{"id":7,"baslik":"Market"}'
}

describe('summarizeToolOutput', () => {
  it('nesneyi JSON metnine çevirir', () => {
    expect(summarizeToolOutput({ a: 1 })).toBe('{"a":1}')
  })

  it('uzun sonucu kısaltır', () => {
    const text = summarizeToolOutput('x'.repeat(TOOL_RESULT_LIMIT + 50))
    expect(text.length).toBeLessThan(TOOL_RESULT_LIMIT + 20)
    expect(text.endsWith('(kısaltıldı)')).toBe(true)
  })

  it('tanımsız sonuçta boş metin döner', () => {
    expect(summarizeToolOutput(undefined)).toBe('')
  })
})

describe('toModelMessages', () => {
  it('araç çağrısı, sonucu ve cevabı sırayla ekler', () => {
    const history = toModelMessages([
      message('user', 'Listeme market ekle'),
      message('assistant', 'Ekledim.', [taskTool])
    ])

    expect(history.map((m) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant'])
    expect(history[1].content).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'gorev_ekle',
        input: { baslik: 'Market' }
      }
    ])
    expect(history[2].content).toEqual([
      {
        type: 'tool-result',
        toolCallId: 'call-1',
        toolName: 'gorev_ekle',
        output: { type: 'text', value: '{"id":7,"baslik":"Market"}' }
      }
    ])
  })

  it('başarısız aracı hata sonucu olarak verir', () => {
    const history = toModelMessages([
      message('assistant', '', [{ ...taskTool, status: 'error', result: 'Başlık boş olamaz.' }])
    ])
    expect(history.map((m) => m.role)).toEqual(['assistant', 'tool'])
    expect(history[1].content).toEqual([
      expect.objectContaining({ output: { type: 'error-text', value: 'Başlık boş olamaz.' } })
    ])
  })

  it('sonucu saklanmamış eski araçları sadece metin olarak geçirir', () => {
    const oldTool: ToolActivity = {
      id: 'call-1',
      name: 'gorev_ekle',
      label: 'Görev ekleme',
      status: 'done'
    }
    const history = toModelMessages([message('assistant', 'Ekledim.', [oldTool])])
    expect(history).toEqual([{ role: 'assistant', content: 'Ekledim.' }])
  })

  it('araç sonuçlarını sadece son cevaplar için ekler', () => {
    const many = Array.from({ length: TOOL_HISTORY_MESSAGES + 2 }, () =>
      message('assistant', 'Tamam', [taskTool])
    )
    const history = toModelMessages(many)
    expect(history.filter((m) => m.role === 'tool')).toHaveLength(TOOL_HISTORY_MESSAGES)
  })

  it('belge eklenmiş kullanıcı mesajını model düzenine çevirir', () => {
    const content =
      'Özetle\n\n[[BELGE ad="a.txt" parca="1/1"]]\nDosya yolu: C:/a.txt\n---\nMetin\n[[/BELGE]]'
    const [user] = toModelMessages([message('user', content)])
    expect(user.content).toContain('<belge ad="a.txt"')
  })
})
