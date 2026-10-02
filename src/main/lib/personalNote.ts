// Kişisel not: Ana Sayfa'daki karşılama cümlesi ve sabah özetinin başı. Hafıza (kim olduğun,
// yakın planların) ve bugünün işleri (görev, hatırlatma, takvim) birlikte modele verilir, model
// 1-2 cümlelik doğal bir not yazar. Bu dosya saf kısım: istek metni ve cevabı temizleme (testli).

export type PersonalNoteKind = 'home' | 'brief'

export interface PersonalContext {
  /** Profil türündeki hafıza kayıtları (adı, işi...) */
  profile: string[]
  /** Yakın zamanda öğrenilen plan/olay kayıtları, öğrenildiği günle */
  upcoming: { content: string; learnedAt: string }[]
  tasks: { title: string; time: string | null; overdue: boolean }[]
  reminders: { message: string; time: string }[]
  /** Google takvimi bağlı değilse veya alınamadıysa null */
  events: { title: string; time: string }[] | null
}

const NOTE_LIMIT = 280

const KIND_INSTRUCTIONS: Record<PersonalNoteKind, string> = {
  home: 'Bu not Pıtır uygulamasının ana ekranında, selamlamanın hemen altında gösterilecek. Selamlama zaten var ("Günaydın" gibi yazma).',
  brief:
    'Bu not sabah özetinin başında sesli okunacak. "Günaydın" zaten söylendi, tekrar yazma. Sayıları ayrıca okunacağı için saymaya gerek yok.'
}

export function buildPersonalNotePrompt(
  context: PersonalContext,
  kind: PersonalNoteKind,
  now: Date
): { instructions: string; prompt: string } {
  const instructions = [
    'Sen Pıtır adlı kişisel asistansın. Kullanıcıya 1 ya da 2 kısa cümlelik, sıcak ve doğal bir Türkçe not yaz.',
    KIND_INSTRUCTIONS[kind],
    'Kullanıcının adını biliyorsan (ör. "Yusuf") bir kez kullan. Bugün için en önemli veya en yakın şeyi öne çıkar (saatli etkinlik, geciken iş, yakın bir plan).',
    'SADECE verilen bilgileri kullan, hiçbir şey uydurma. Söylenecek önemli bir şey yoksa kısa ve rahatlatıcı bir cümle yaz.',
    'Markdown, madde işareti, emoji, tırnak kullanma. Sadece notu yaz.'
  ].join('\n')

  const today = now.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long'
  })
  const time = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const lines = [`Şu an: ${today}, saat ${time}`]
  lines.push('', 'Kullanıcı hakkında:')
  lines.push(
    ...(context.profile.length > 0 ? context.profile.map((p) => `- ${p}`) : ['- (bilinmiyor)'])
  )
  if (context.upcoming.length > 0) {
    lines.push('', 'Yakın planları ve olaylar (ne zaman öğrenildiğiyle):')
    lines.push(...context.upcoming.map((u) => `- [${u.learnedAt}] ${u.content}`))
  }
  lines.push('', 'Bugünkü takvim:')
  if (context.events === null) lines.push('- (takvim bağlı değil)')
  else if (context.events.length === 0) lines.push('- etkinlik yok')
  else lines.push(...context.events.map((e) => `- ${e.time} ${e.title}`))
  lines.push('', 'Bugünkü ve geciken görevler:')
  lines.push(
    ...(context.tasks.length > 0
      ? context.tasks.map(
          (t) => `- ${t.title}${t.time ? ` (${t.time})` : ''}${t.overdue ? ' [gecikmiş]' : ''}`
        )
      : ['- yok'])
  )
  lines.push('', 'Bugünkü hatırlatmalar:')
  lines.push(
    ...(context.reminders.length > 0
      ? context.reminders.map((r) => `- ${r.time} ${r.message}`)
      : ['- yok'])
  )
  return { instructions, prompt: lines.join('\n') }
}

// Başlık saate uygun selamı zaten veriyor ("İyi geceler"); model talimata rağmen "Günaydın Yusuf,"
// ile başlayınca ikisi çelişiyordu. Baştaki selamlaşma kodla atılır.
// Türkçe küçük harfe çevrilmiş metinde aranır ("İyi" → "iyi"; /i bayrağı İ ile i'yi eşlemiyor)
const LEADING_GREETING =
  /^(günaydın|tünaydın|iyi (sabahlar|günler|akşamlar|geceler)|merhaba|selamlar|selam|hey)(?=[\s,!.]|$)[\s,!.]*/

function stripLeadingGreeting(text: string): string {
  const match = LEADING_GREETING.exec(text.toLocaleLowerCase('tr-TR'))
  return match ? text.slice(match[0].length) : text
}

/** Modelin cevabını gösterilebilir nota çevirir; kullanılamazsa null */
export function cleanPersonalNote(raw: string): string | null {
  let text = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\s\S]*<\/think>/i, '')
    .replace(/<think>[\s\S]*$/i, '')
    .replace(/[*#`"“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  text = stripLeadingGreeting(text)
  // Selam atılınca cümle küçük harfle başlayabilir ("yusuf, bugün...")
  text = text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1)
  if (text.length < 8) return null
  return text.length > NOTE_LIMIT ? `${text.slice(0, NOTE_LIMIT - 1).trim()}…` : text
}
