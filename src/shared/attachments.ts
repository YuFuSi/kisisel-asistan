import type { AttachedDocument } from './api'

// Sohbete eklenen belgeler kullanıcı mesajının içine bu etiketlerle gömülerek saklanır.
// Arayüz etiketi görünce belgeyi küçük bir kart olarak gösterir. Modele giderken mesaj
// toModelContent ile "önce belge, en sonda soru" düzenine çevrilir; yoksa küçük modeller
// belge bloğunu cevap diye aynen tekrar yazabiliyor.
const BLOCK_PATTERN =
  /\n*\[\[BELGE ad="([^"\n]*)" parca="(\d+)\/(\d+)"\]\]\n?([\s\S]*?)\n?\[\[\/BELGE\]\]\n*/g

export interface AttachmentSummary {
  name: string
  partCount: number
}

interface ParsedAttachment extends AttachmentSummary {
  /** Etiketlerin arasındaki metin (dosya yolu, not ve belge metni) */
  body: string
}

const safeName = (name: string): string => name.replace(/["\r\n]/g, "'")

/** Bir belgeyi mesaja gömülecek metin bloğuna çevirir */
export function formatAttachment(doc: AttachedDocument): string {
  const lines = [`[[BELGE ad="${safeName(doc.name)}" parca="1/${doc.partCount}"]]`]
  lines.push(`Dosya yolu: ${doc.path}`)
  if (doc.partCount > 1) {
    lines.push(
      `Bu, belgenin ${doc.partCount} parçasından 1. parça (toplam ${doc.charCount} karakter). Devamı için belge_oku aracını bu dosya yolu ve bolum: 2 ile kullan.`
    )
  }
  lines.push('---', doc.text, '[[/BELGE]]')
  return lines.join('\n')
}

/** Kullanıcının yazdığı metni ve eklenen belgeleri tek mesajda birleştirir */
export function composeMessage(text: string, docs: AttachedDocument[]): string {
  return [text.trim(), ...docs.map(formatAttachment)].filter((part) => part !== '').join('\n\n')
}

function parseAttachments(content: string): { text: string; documents: ParsedAttachment[] } {
  const documents: ParsedAttachment[] = []
  const text = content.replace(
    BLOCK_PATTERN,
    (_match, name: string, _part: string, total: string, body: string) => {
      documents.push({ name, partCount: Number(total), body: body.trim() })
      return '\n\n'
    }
  )
  return { text: text.trim(), documents }
}

/** Mesajdaki belge bloklarını ayırır: arayüzde metin ve belge kartları ayrı gösterilir */
export function splitAttachments(content: string): {
  text: string
  documents: AttachmentSummary[]
} {
  const { text, documents } = parseAttachments(content)
  return { text, documents: documents.map(({ name, partCount }) => ({ name, partCount })) }
}

/** Belge eklenmiş mesajı modelin doğru anlayacağı düzene çevirir: önce belgeler, en sonda istek */
export function toModelContent(content: string): string {
  const { text, documents } = parseAttachments(content)
  if (documents.length === 0) return content

  // Uzun belgelerde sadece ilk parça gelir; not en sona konur ki model gözden kaçırmasın
  const partial = documents
    .filter((doc) => doc.partCount > 1)
    .map(
      (doc) =>
        `Not: "${safeName(doc.name)}" belgesinin ${doc.partCount} parçasından sadece 1. parçası yukarıda. İstek belgenin geri kalanıyla ilgiliyse (ör. sonu, tamamının özeti) cevap vermeden önce belge_oku aracını hemen çağırıp gerekli parçaları oku (“okumam gerekiyor” deyip durma, aracı doğrudan çağır; son kısım için bolum olarak son parça numarasını ver). Görmediğin kısım hakkında tahmin yürütme.`
    )

  return [
    'Kullanıcı bu mesaja belge ekledi. Belge metni aşağıda <belge> etiketleri arasında. Bu metni cevabında tekrar yazma; kullanıcının isteğini belgeye dayanarak cevapla.',
    ...documents.map(
      (doc) =>
        `<belge ad="${safeName(doc.name)}" parca="1/${doc.partCount}">\n${doc.body}\n</belge>`
    ),
    ...partial,
    `Kullanıcının isteği: ${text}`
  ].join('\n\n')
}
