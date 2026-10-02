import { desktopCapturer, screen } from 'electron'
import { generateText, tool } from 'ai'
import { z } from 'zod'
import { createOllama } from 'ollama-ai-provider-v2'
import { getSettings } from '../settings'
import { requireApproval } from './approval'
import type { ToolModule } from './types'

// Ekranı görme, ayarlardaki sohbet modelinden bağımsız, sabit bir yerel görüntü modeli kullanır
// (qwen3:14b gibi metin modelleri görüntü kabul etmiyor). Kullanıcı onayıyla indirildi (2026-09-16,
// Apache 2.0, ~6 GB). qwen3:14b zaten VRAM'de olduğu için Ollama bu modeli gerektiğinde yükleyip
// işi bitince eski modeli geri yükler; ilk kullanımda birkaç saniyelik bir model değişimi olur.
export const VISION_MODEL = 'qwen2.5vl:7b'
// Ekranın tamamı yerine makul bir üst sınır: hem istek boyutu hem model için yeterli çözünürlük
const MAX_DIMENSION = 1600

export async function captureScreen(): Promise<Buffer> {
  const display = screen.getPrimaryDisplay()
  const scale = Math.min(1, MAX_DIMENSION / Math.max(display.size.width, display.size.height))
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(display.size.width * scale),
      height: Math.round(display.size.height * scale)
    }
  })
  const source = sources[0]
  if (!source || source.thumbnail.isEmpty()) throw new Error('Ekran görüntüsü alınamadı.')
  return source.thumbnail.toPNG()
}

const visionTools: ToolModule = {
  risks: { ekrani_gor: 'dangerous' },
  selfApproval: ['ekrani_gor'],
  labels: { ekrani_gor: 'Ekranı görme' },
  tools: {
    ekrani_gor: tool({
      description:
        'Kullanıcının ekranının anlık görüntüsünü alıp verilen soruya göre yorumlar. "Ekranımda ne var", "bu hatayı açıkla", "bu ekranda ne yapmam lazım" gibi isteklerde kullan. Kullanıcıdan onay istenir.',
      inputSchema: z.object({
        soru: z
          .string()
          .describe('Ekran görüntüsüyle ilgili soru, ör. "Bu hata ne anlama geliyor?"')
      }),
      execute: async ({ soru }) => {
        await requireApproval({
          toolName: 'ekrani_gor',
          label: 'Ekran görüntüsü alınıp yapay zekaya gönderilsin mi?',
          summary: soru
        })

        const image = await captureScreen()
        const { ollamaBaseUrl } = getSettings()
        const ollama = createOllama({ baseURL: `${ollamaBaseUrl}/api` })

        try {
          const { text } = await generateText({
            model: ollama(VISION_MODEL),
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: soru },
                  // ollama-ai-provider-v2 (4.0.1), ham Buffer/Uint8Array verilince kendi içindeki
                  // base64 dönüşümünde hata veriyor (FileData yerine bayt dizisi bekliyor);
                  // base64 metin olarak vermek bu kodu hiç çalıştırmadan sorunu atlıyor.
                  { type: 'file', data: image.toString('base64'), mediaType: 'image/png' }
                ]
              }
            ]
          })
          return { yanit: text }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          if (/not found|404/i.test(message)) {
            throw new Error(
              `Görüntü modeli (${VISION_MODEL}) bulunamadı. Terminalde "ollama pull ${VISION_MODEL}" ile indirilmesi gerekiyor.`
            )
          }
          throw new Error(`Ekran görüntüsü yorumlanamadı: ${message}`)
        }
      }
    })
  }
}

export default visionTools
