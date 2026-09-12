import { promises as fs, type Dirent } from 'node:fs'
import { join } from 'node:path'

export interface FoundFile {
  ad: string
  yol: string
  boyutKb: number
  degistirilme: string
}

// Aramada girilmeyecek klasörler
const SKIP_DIRS = new Set([
  'node_modules',
  'AppData',
  '$RECYCLE.BIN',
  'System Volume Information',
  'Windows'
])

export interface SearchOptions {
  /** Aranan kelimeler; hepsi dosya adında geçmeli */
  query: string
  roots: string[]
  limit?: number
  maxDepth?: number
  timeoutMs?: number
}

/**
 * Basit dosya arama: klasörleri genişlik öncelikli tarar ve adı tüm kelimeleri içeren dosyaları döndürür.
 * Büyük/küçük harf farkı Türkçe kurallarına göre yok sayılır. Süre ve sonuç sayısı sınırlıdır.
 */
export async function searchFiles(options: SearchOptions): Promise<FoundFile[]> {
  const words = options.query.toLocaleLowerCase('tr-TR').split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const limit = options.limit ?? 20
  const maxDepth = options.maxDepth ?? 4
  const deadline = Date.now() + (options.timeoutMs ?? 8000)
  const results: FoundFile[] = []
  let queue = options.roots.map((dir) => ({ dir, depth: 0 }))

  while (queue.length > 0 && results.length < limit && Date.now() < deadline) {
    const nextLevel: { dir: string; depth: number }[] = []
    for (const { dir, depth } of queue) {
      if (results.length >= limit || Date.now() > deadline) break
      let items: Dirent[]
      try {
        items = await fs.readdir(dir, { withFileTypes: true })
      } catch {
        // Erişilemeyen klasörleri atla
        continue
      }
      for (const item of items) {
        if (item.name.startsWith('.') || SKIP_DIRS.has(item.name)) continue
        const fullPath = join(dir, item.name)
        if (item.isDirectory()) {
          if (depth < maxDepth) nextLevel.push({ dir: fullPath, depth: depth + 1 })
          continue
        }
        if (!item.isFile()) continue
        const name = item.name.toLocaleLowerCase('tr-TR')
        if (!words.every((word) => name.includes(word))) continue
        try {
          const stat = await fs.stat(fullPath)
          results.push({
            ad: item.name,
            yol: fullPath,
            boyutKb: Math.max(1, Math.round(stat.size / 1024)),
            degistirilme: stat.mtime.toLocaleDateString('tr-TR')
          })
        } catch {
          // Okunamayan dosyayı atla
        }
        if (results.length >= limit) break
      }
    }
    queue = nextLevel
  }
  return results
}
