// Sohbet başlığının en fazla uzunluğu
const TITLE_LENGTH = 48

/**
 * Modelin ürettiği ham metinden kullanılabilir bir sohbet başlığı çıkarır.
 * Bazı modeller cevabı <think> etiketiyle sarar veya başlığı tırnak içine alır.
 */
export function cleanTitle(raw: string): string {
  const title = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/["'`*#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(başlık|title)\s*:\s*/i, '')
    .replace(/[.:;,]+$/, '')
    .trim()
  return title.length > TITLE_LENGTH ? `${title.slice(0, TITLE_LENGTH - 1).trim()}…` : title
}
