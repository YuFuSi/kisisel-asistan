import { describe, expect, it } from 'vitest'
import { filterCommands } from './commandPalette'

const commands = [
  { id: 'a', label: 'Ana Sayfa', group: 'Sayfalar' },
  { id: 'b', label: 'Takvim', group: 'Sayfalar', keywords: 'ajanda etkinlik' },
  { id: 'c', label: 'İşlem', group: 'Hızlı' }
]

describe('filterCommands', () => {
  it('boş sorguda hepsini döner', () => {
    expect(filterCommands(commands, '')).toHaveLength(3)
  })

  it('etiketle eşleşir', () => {
    expect(filterCommands(commands, 'takvim').map((c) => c.id)).toEqual(['b'])
  })

  it('anahtar kelimeyle de eşleşir', () => {
    expect(filterCommands(commands, 'ajanda').map((c) => c.id)).toEqual(['b'])
  })

  it('Türkçe büyük İ/i ayrımını doğru yapar', () => {
    expect(filterCommands(commands, 'İŞLEM').map((c) => c.id)).toEqual(['c'])
  })

  it('eşleşme yoksa boş döner', () => {
    expect(filterCommands(commands, 'zzz')).toEqual([])
  })
})
