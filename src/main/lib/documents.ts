import { promises as fs } from 'node:fs'
import { basename, extname } from 'node:path'

/** Okunabilen dosya türleri */
export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.csv', '.json', '.log']

/** Bir seferde modele verilecek en fazla karakter. Uzun belgeler parçalara bölünür. */
export const PART_SIZE = 8000

/** Çok büyük dosyalar okunmaya çalışılmaz (bellek ve süre için) */
const MAX_FILE_BYTES = 30 * 1024 * 1024

export interface DocumentText {
  /** Dosyanın adı, ör. "rapor.pdf" */
  name: string
  /** İstenen parçanın metni */
  text: string
  /** Kaçıncı parça (1'den başlar) */
  part: number
  /** Toplam parça sayısı */
  partCount: number
  /** Belgenin tamamındaki karakter sayısı */
  charCount: number
}

/** Metni yaklaşık `size` karakterlik parçalara böler; mümkünse satır sonlarından keser. */
export function splitIntoParts(text: string, size = PART_SIZE): string[] {
  if (text.length <= size) return [text]

  const parts: string[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + size, text.length)
    if (end < text.length) {
      // Son %20'lik kısımda bir satır sonu varsa oradan böl (cümleyi ortadan kesmemek için)
      const breakPoint = text.lastIndexOf('\n', end)
      if (breakPoint > start + size * 0.8) end = breakPoint + 1
    }
    parts.push(text.slice(start, end).trim())
    start = end
  }
  return parts.filter((part) => part !== '')
}

/** Fazla boş satır ve satır sonu boşluklarını temizler */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function readPdf(filePath: string): Promise<string> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(await fs.readFile(filePath))
  // verbosity 0: sadece metin okunuyor, yazı tipi uyarıları loga düşmesin
  const loadingTask = getDocument({ data, useSystemFonts: false, verbosity: 0 })
  const pdf = await loadingTask.promise

  const pages: string[] = []
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
        .join('')
      pages.push(`--- Sayfa ${i} ---\n${text.trim()}`)
      page.cleanup()
    }
  } finally {
    await loadingTask.destroy()
  }
  return pages.join('\n\n')
}

async function readDocx(filePath: string): Promise<string> {
  const mammoth = await import('mammoth')
  const extract = mammoth.default?.extractRawText ?? mammoth.extractRawText
  const { value } = await extract({ path: filePath })
  return value
}

/** Dosyanın tüm metnini çıkarır. Desteklenmeyen tür veya boş belgede hata verir. */
export async function extractDocumentText(filePath: string): Promise<string> {
  const extension = extname(filePath).toLowerCase()
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    throw new Error(
      `"${extension || 'uzantısız'}" dosyaları okunamıyor. Desteklenenler: ${SUPPORTED_EXTENSIONS.join(', ')}`
    )
  }

  // Sembolik bağı/junction'ı gerçek hedefine çözer; okuma sırasında (TOCTOU) hedef değişse bile
  // stat ve gerçek okuma aynı somut dosyaya bakar.
  const realPath = await fs.realpath(filePath).catch(() => filePath)
  const stat = await fs.stat(realPath).catch(() => null)
  if (!stat?.isFile()) throw new Error(`Dosya bulunamadı: ${filePath}`)
  if (stat.size > MAX_FILE_BYTES) throw new Error('Dosya çok büyük (en fazla 30 MB).')

  let raw: string
  if (extension === '.pdf') raw = await readPdf(realPath)
  else if (extension === '.docx') raw = await readDocx(realPath)
  else raw = await fs.readFile(realPath, 'utf8')

  const text = tidy(raw)
  if (!text) {
    throw new Error(
      'Belgeden metin çıkarılamadı. Taranmış (resim) bir PDF olabilir; bu tür belgeler okunamıyor.'
    )
  }
  return text
}

/** Belgenin istenen parçasını okur (parça numarası 1'den başlar). */
export async function readDocumentPart(filePath: string, part = 1): Promise<DocumentText> {
  const text = await extractDocumentText(filePath)
  const parts = splitIntoParts(text)
  const index = Math.min(Math.max(Math.round(part), 1), parts.length) - 1

  return {
    name: basename(filePath),
    text: parts[index],
    part: index + 1,
    partCount: parts.length,
    charCount: text.length
  }
}
