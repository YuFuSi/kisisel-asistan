// Akış halinde gelen cevabı cümlelere böler; her cümle hazır olur olmaz seslendirilebilir.
// Böylece Jarvis cevabın tamamı bitmeden konuşmaya başlar.

// Bundan kısa parçalar bir sonraki cümleyle birleştirilir ("Tamam." gibi tek kelimeler ayrı seslenmesin)
const MIN_LENGTH = 24
const BOUNDARY = /[.!?…]+["')\]]*\s|\n/

export class SentenceSplitter {
  private buffer = ''

  push(text: string): string[] {
    this.buffer += text
    const sentences: string[] = []
    let searchFrom = 0
    for (;;) {
      const match = BOUNDARY.exec(this.buffer.slice(searchFrom))
      if (!match) break
      const end = searchFrom + match.index + match[0].length
      const candidate = this.buffer.slice(0, end).trim()
      if (candidate.length < MIN_LENGTH && match[0] !== '\n') {
        searchFrom = end
        continue
      }
      if (candidate) sentences.push(candidate)
      this.buffer = this.buffer.slice(end)
      searchFrom = 0
    }
    return sentences
  }

  /** Cevap bitince kalan son parça */
  flush(): string | null {
    const rest = this.buffer.trim()
    this.buffer = ''
    return rest || null
  }
}
