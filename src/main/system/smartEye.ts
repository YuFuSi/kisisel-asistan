import type { Activity } from '../../shared/activity'
import { DEFAULT_OLLAMA_CONTEXT, PROVIDERS } from '../../shared/api'
import { isAnyReplying } from '../ai/chat'
import { getSettings } from '../settings'
import { captureScreen, VISION_MODEL } from '../tools/vision'
import { cleanRemark } from '../lib/remark'

// Akıllı göz (masaüstü arkadaş, Aşama 2): Pıtır arada bir ekrana bakıp içeriğe göre kısa bir yorum yapar.
// - Kullanıcı Ayarlar'dan açar (varsayılan kapalı). Görüntü sadece bilgisayardaki görüntü modeline
//   (Ollama, qwen2.5vl) gider; diske yazılmaz, günlüğe içerik yazılmaz.
// - Seyrek: aynı aktivitede en az 2 dk kalınca, iki bakış arasında en az 20 dk (gevezede 10 dk).
// - Asla bakmaz: sohbet/mesajlaşma, toplantı, gizli sekme, şifre/banka/ödeme sayfaları, Pıtır
//   bir iş yaparken, konuşkanlık "sessiz"deyken.
// - Görüntü modeli Qwen ile aynı anda ekran kartına sığmadığı için bakıştan hemen sonra bellekten
//   çıkarılır (keep_alive: 0); sonraki sohbet mesajında Qwen birkaç saniyede yeniden yüklenir.

const STEADY_MS = 2 * 60_000
const GAP_MS = { quiet: Infinity, sometimes: 20 * 60_000, chatty: 10 * 60_000 } as const
const LOOK_KINDS: Activity['kind'][] = ['video', 'browse', 'game', 'code', 'document', 'music']
// Pencere başlığında bunlar varsa ekrana asla bakılmaz
const PRIVATE_TITLE =
  /(inprivate|incognito|gizli pencere|gizli sekme|şifre|parola|password|banka|bank|ödeme|payment|kredi kartı|credit card|giriş yap|sign in|log in|login|e-devlet|hastane|sağlık)/i

// 1. adım: görüntü modeli ekrandakini kısa bir İngilizce cümleyle anlatır (bu modeller İngilizcede
// çok daha isabetli; Türkçesi zayıf ve emoji kullanıyor)
const SEE_PROMPT =
  'In one short English sentence, describe what the user is doing or looking at on this screen. ' +
  'Do not include names, message contents, numbers or other personal details.'

// 2. adım: yerel sohbet modeli (Türkçesi iyi) anlatımdan Pıtır'ın kısa yorumunu yazar
const sayPrompt = (description: string): string =>
  'Sen Pıtır adında, kullanıcının masaüstünde yaşayan küçük, sevimli bir cam robotsun. ' +
  `Kullanıcının ekranında şu var: "${description}". ` +
  'Buna kullanıcıya hitaben (sen diye) en fazla 8 kelimelik, samimi, esprili, yargılamayan TEK bir ' +
  'Türkçe cümle söyle. Emoji, tırnak, isim kullanma. Sadece cümleyi yaz. Örnek tonlar: ' +
  '"Ben de izliyorum, belli etme." / "Kod akıyor, ben izliyorum." / "Sekmeler küçük bir şehir kurdu."'

let activitySince = 0
let lastKind = ''
let lastLookAt = 0
let looking = false

/** Ana süreçteki aktivite takibinden çağrılır; uygunsa ekrana bakar ve yorumu döner */
export function noteActivityForEye(activity: Activity, title: string): Promise<string | null> {
  const now = Date.now()
  if (activity.kind !== lastKind) {
    lastKind = activity.kind
    activitySince = now
  }
  const settings = getSettings()
  if (!settings.smartEyeEnabled || !settings.companionEnabled || looking)
    return Promise.resolve(null)
  if (!LOOK_KINDS.includes(activity.kind)) return Promise.resolve(null)
  if (PRIVATE_TITLE.test(title)) return Promise.resolve(null)
  if (now - activitySince < STEADY_MS) return Promise.resolve(null)
  if (now - lastLookAt < GAP_MS[settings.companionChattiness]) return Promise.resolve(null)
  if (isAnyReplying()) return Promise.resolve(null)
  lastLookAt = now
  return look()
}

async function look(): Promise<string | null> {
  looking = true
  try {
    const image = await captureScreen()
    const settings = getSettings()
    const generate = async (body: Record<string, unknown>): Promise<string> => {
      const response = await fetch(`${settings.ollamaBaseUrl}/api/generate`, {
        method: 'POST',
        body: JSON.stringify({ stream: false, ...body }),
        signal: AbortSignal.timeout(120_000)
      })
      if (!response.ok) throw new Error(`Ollama ${response.status}`)
      const { response: text } = (await response.json()) as { response?: string }
      return (text ?? '').trim()
    }
    const description = await generate({
      model: VISION_MODEL,
      prompt: SEE_PROMPT,
      images: [image.toString('base64')],
      // Bakış biter bitmez ekran kartından çıkar; Qwen'e yer kalsın
      keep_alive: 0,
      options: { num_predict: 50, temperature: 0.2 }
    })
    if (!description) return null
    const text = await generate({
      model: settings.models.ollama || PROVIDERS.ollama.defaultModel,
      prompt: sayPrompt(description),
      think: false,
      // Sohbetle aynı bağlam uzunluğu: farklı değer modeli yeniden yükletir
      options: {
        num_ctx: settings.contextLength ?? DEFAULT_OLLAMA_CONTEXT,
        num_predict: 40,
        temperature: 0.8
      }
    })
    const remark = cleanRemark(text)
    console.info(`Akıllı göz: ${remark ? 'yorum yapıldı' : 'yorum çıkmadı'}`)
    return remark
  } catch (err) {
    console.warn('Akıllı göz bakamadı:', err instanceof Error ? err.message : err)
    return null
  } finally {
    looking = false
  }
}
