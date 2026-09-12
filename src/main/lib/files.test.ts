import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { searchFiles } from './files'

let root: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'asistan-dosya-'))
  await mkdir(join(root, 'Belgeler', 'Faturalar'), { recursive: true })
  await mkdir(join(root, 'node_modules'), { recursive: true })
  await writeFile(join(root, 'Belgeler', 'Faturalar', 'Elektrik Faturası.pdf'), 'test')
  await writeFile(join(root, 'Belgeler', 'Işık raporu.docx'), 'test')
  await writeFile(join(root, 'node_modules', 'fatura.pdf'), 'test')
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('searchFiles', () => {
  it('alt klasörlerde arar ve Türkçe büyük/küçük harfi doğru karşılaştırır', async () => {
    const found = await searchFiles({ query: 'fatura', roots: [root] })
    expect(found.map((file) => file.ad)).toEqual(['Elektrik Faturası.pdf'])

    const upper = await searchFiles({ query: 'IŞIK', roots: [root] })
    expect(upper.map((file) => file.ad)).toEqual(['Işık raporu.docx'])
  })

  it('tüm kelimeleri içeren dosyaları bulur', async () => {
    const found = await searchFiles({ query: 'fatura pdf', roots: [root] })
    expect(found).toHaveLength(1)
    const none = await searchFiles({ query: 'fatura docx', roots: [root] })
    expect(none).toHaveLength(0)
  })

  it('node_modules gibi klasörleri atlar ve sonuç sayısını sınırlar', async () => {
    const found = await searchFiles({ query: 'pdf', roots: [root] })
    expect(found.every((file) => !file.yol.includes('node_modules'))).toBe(true)

    const limited = await searchFiles({ query: 'test', roots: [root], limit: 1 })
    expect(limited.length).toBeLessThanOrEqual(1)
  })
})
