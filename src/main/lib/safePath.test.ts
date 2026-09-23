import { mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { assertWithinRoot, isWithinRoot } from './safePath'

describe('isWithinRoot', () => {
  it('gerçek alt yolu kabul eder', () => {
    expect(isWithinRoot('C:\\Users\\ysfll', 'C:\\Users\\ysfll\\Desktop\\dosya.txt')).toBe(true)
  })

  it('kardeş klasöre kanmaz (önek eşleşmesi tuzağı)', () => {
    expect(isWithinRoot('C:\\Users\\ysfll', 'C:\\Users\\ysfll2\\gizli.txt')).toBe(false)
  })

  it('kökün kendisini kabul etmez', () => {
    expect(isWithinRoot('C:\\Users\\ysfll', 'C:\\Users\\ysfll')).toBe(false)
  })

  it('yukarı çıkan (..) yolu reddeder', () => {
    expect(isWithinRoot('C:\\Users\\ysfll\\Desktop', 'C:\\Users\\ysfll\\gizli.txt')).toBe(false)
  })

  it('tamamen başka bir sürücüyü reddeder', () => {
    expect(isWithinRoot('C:\\Users\\ysfll', 'D:\\baska\\dosya.txt')).toBe(false)
  })
})

describe('assertWithinRoot', () => {
  let dir: string

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('gerçek dosya için kök altındaki gerçek yolu döner', async () => {
    dir = await mkdtemp(join(tmpdir(), 'safepath-'))
    const inside = join(dir, 'dosya.txt')
    await writeFile(inside, 'merhaba')

    const result = await assertWithinRoot(dir, inside, 'reddedildi')
    // Beklenen taraf da realpath'ten geçirilir: Windows bazı makinelerde/CI çalıştırıcılarında
    // kısa (8.3, "RUNNER~1") ad döndürebiliyor, bazılarında döndürmüyor — ikisi de aynı normalize
    // biçimden geçince karşılaştırma tutarlı olur.
    expect(result.toLowerCase()).toBe((await realpath(inside)).toLowerCase())
  })

  it('var olmayan dosyada hata fırlatır', async () => {
    dir = await mkdtemp(join(tmpdir(), 'safepath-'))
    await expect(assertWithinRoot(dir, join(dir, 'yok.txt'), 'reddedildi')).rejects.toThrow(
      'reddedildi'
    )
  })

  it('kök dışına çıkan symlink hedefini reddeder', async () => {
    dir = await mkdtemp(join(tmpdir(), 'safepath-'))
    const outside = await mkdtemp(join(tmpdir(), 'safepath-disari-'))
    const outsideFile = join(outside, 'gizli.txt')
    await writeFile(outsideFile, 'sır')
    const link = join(dir, 'baglanti.txt')

    try {
      await symlink(outsideFile, link)
    } catch {
      // Bu makinede symlink oluşturma izni yoksa (Windows'ta yönetici gerektirebilir) testi atla
      await rm(outside, { recursive: true, force: true })
      return
    }

    await expect(assertWithinRoot(dir, link, 'reddedildi')).rejects.toThrow('reddedildi')
    await rm(outside, { recursive: true, force: true })
  })
})
