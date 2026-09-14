import { tool } from 'ai'
import { z } from 'zod'
import { getSecret } from '../settings'
import type { ToolModule } from './types'

const SEARCH_URL = 'https://api.tavily.com/search'
const TIMEOUT_MS = 20_000
const MAX_SNIPPET = 600

interface TavilyResponse {
  answer?: string
  results?: { title: string; url: string; content: string }[]
}

const searchTools: ToolModule = {
  risks: { web_ara: 'read' },
  isAvailable: () => getSecret('tavily') !== undefined,
  labels: { web_ara: 'İnternette arama' },
  tools: {
    web_ara: tool({
      description:
        'İnternette arama yapar. Güncel olaylar, haberler, fiyatlar veya bilmediğin konular sorulduğunda kullan. Cevabında kaynak adreslerini de belirt.',
      inputSchema: z.object({
        sorgu: z.string().describe('Arama sorgusu'),
        konu: z.enum(['genel', 'haber']).optional().describe('Haber araması için "haber" gönder')
      }),
      execute: async (input) => {
        const key = getSecret('tavily')
        if (!key) {
          throw new Error(
            'İnternette arama için Tavily API anahtarı gerekiyor. Ayarlar sayfasındaki Servisler bölümünden ekleyebilirsin; tavily.com ücretsiz anahtar veriyor.'
          )
        }

        let response: Response
        try {
          response = await fetch(SEARCH_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
            body: JSON.stringify({
              query: input.sorgu,
              max_results: 5,
              include_answer: 'basic',
              search_depth: 'basic',
              topic: input.konu === 'haber' ? 'news' : 'general'
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS)
          })
        } catch {
          throw new Error('Arama servisine bağlanılamadı. İnternet bağlantını kontrol et.')
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error("Tavily API anahtarı geçersiz. Ayarlar'dan kontrol et.")
        }
        if (response.status === 429) {
          throw new Error('Tavily kullanım limitine ulaşıldı. Biraz bekleyip tekrar dene.')
        }
        if (!response.ok) throw new Error(`Arama servisi hata verdi (HTTP ${response.status}).`)

        const data = (await response.json()) as TavilyResponse
        return {
          ozet: data.answer ?? null,
          sonuclar: (data.results ?? []).map((result) => ({
            baslik: result.title,
            adres: result.url,
            alinti:
              result.content.length > MAX_SNIPPET
                ? `${result.content.slice(0, MAX_SNIPPET)}…`
                : result.content
          }))
        }
      }
    })
  }
}

export default searchTools
