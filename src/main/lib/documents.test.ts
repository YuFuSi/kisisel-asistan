import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { extractDocumentText, readDocumentPart, splitIntoParts } from './documents'

const folder = mkdtempSync(join(tmpdir(), 'asistan-belge-'))
afterAll(() => rmSync(folder, { recursive: true, force: true }))

describe('splitIntoParts', () => {
  it('kısa metni tek parça bırakır', () => {
    expect(splitIntoParts('merhaba', 100)).toEqual(['merhaba'])
  })

  it('uzun metni satır sonlarından böler ve metni kaybetmez', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Satır ${i} ${'x'.repeat(30)}`)
    const text = lines.join('\n')
    const parts = splitIntoParts(text, 200)

    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(200)
    // Her parça tam bir satırla başlar (satır ortasından kesilmemiş)
    for (const part of parts) expect(part.startsWith('Satır')).toBe(true)
    expect(parts.join('\n')).toBe(text)
  })
})

describe('extractDocumentText', () => {
  it('düz metin dosyasını okur ve boşlukları toplar', async () => {
    const file = join(folder, 'not.txt')
    writeFileSync(file, 'Birinci satır   \r\n\r\n\r\n\r\nİkinci satır')
    expect(await extractDocumentText(file)).toBe('Birinci satır\n\nİkinci satır')
  })

  it('desteklenmeyen türde Türkçe hata verir', async () => {
    const file = join(folder, 'resim.png')
    writeFileSync(file, 'x')
    await expect(extractDocumentText(file)).rejects.toThrow('okunamıyor')
  })

  it('olmayan dosyada hata verir', async () => {
    await expect(extractDocumentText(join(folder, 'yok.txt'))).rejects.toThrow('bulunamadı')
  })

  it('boş belgede hata verir', async () => {
    const file = join(folder, 'bos.md')
    writeFileSync(file, '   \n  ')
    await expect(extractDocumentText(file)).rejects.toThrow('metin çıkarılamadı')
  })
})

describe('readDocumentPart', () => {
  it('parça bilgisini ve adı döndürür, taşan parça numarasını sınırlar', async () => {
    const file = join(folder, 'uzun.txt')
    writeFileSync(file, Array.from({ length: 2000 }, (_, i) => `satır ${i}`).join('\n'))

    const first = await readDocumentPart(file)
    expect(first.name).toBe('uzun.txt')
    expect(first.part).toBe(1)
    expect(first.partCount).toBeGreaterThan(1)

    const last = await readDocumentPart(file, 999)
    expect(last.part).toBe(first.partCount)
  })
})
