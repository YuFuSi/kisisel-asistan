// Sohbet başlığının en fazla uzunluğu
const TITLE_LENGTH = 48

// Modelin başlık yerine yazdığı düşünce metinleri ("THOUGHTS: The user wants...")
const REASONING_PREFIX = /^(thoughts?|thinking|reasoning|analysis|düşünce(ler)?)\s*:/i

/**
 * Modelin ürettiği ham metinden kullanılabilir bir sohbet başlığı çıkarır.
 * Bazı modeller cevabı <think> etiketiyle sarar, başlığı tırnak içine alır veya önce
 * düşüncesini yazıp başlığı son satıra koyar. Başlık çıkarılamazsa boş döner.
 */
export function cleanTitle(raw: string): string {
  const withoutThinking = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\s\S]*<\/think>/i, '')
    .replace(/<think>[\s\S]*$/i, '')
  const lines = withoutThinking.split('\n').filter((line) => line.trim())
  const lastLine = (lines.at(-1) ?? '').trim()
  if (REASONING_PREFIX.test(lastLine)) return ''
  const title = lastLine
    .replace(/["'`*#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(başlık|title)\s*:\s*/i, '')
    .replace(/[.:;,]+$/, '')
    .trim()
  return title.length > TITLE_LENGTH ? `${title.slice(0, TITLE_LENGTH - 1).trim()}…` : title
}
