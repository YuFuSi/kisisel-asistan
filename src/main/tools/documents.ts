import { resolve } from 'node:path'
import { tool } from 'ai'
import { z } from 'zod'
import { readDocumentPart, SUPPORTED_EXTENSIONS } from '../lib/documents'
import { requireApproval } from './approval'
import { getToolContext } from './context'
import type { ToolModule } from './types'

// Kullanıcının bu sohbette okunmasına izin verdiği dosyalar ("sohbet:yol").
// Uzun belgenin 2., 3. parçası okunurken her seferinde yeniden onay sorulmasın diye tutulur.
const approvedReads = new Set<string>()

/** Kullanıcının sohbete sürükleyip bıraktığı dosya, onay sormadan okunabilir */
export function allowDocument(conversationId: number, filePath: string): void {
  approvedReads.add(`${conversationId}:${resolve(filePath).toLowerCase()}`)
}

const documentTools: ToolModule = {
  labels: { belge_oku: 'Belge okuma' },
  tools: {
    belge_oku: tool({
      description: `Bilgisayardaki bir belgenin metnini okur (${SUPPORTED_EXTENSIONS.join(', ')}). Uzun belgeler parçalara bölünür; sonuçtaki toplamParca 1'den büyükse devamı için aynı dosyayı bolum: 2, 3... ile tekrar oku. Dosya yolunu bilmiyorsan önce dosya_bul aracını kullan. İlk okumada kullanıcıdan onay istenir.`,
      inputSchema: z.object({
        dosyaYolu: z.string().describe('Belgenin tam yolu, ör. C:\\Users\\...\\rapor.pdf'),
        bolum: z
          .number()
          .int()
          .optional()
          .describe('Okunacak parça numarası (1den başlar). İlk okumada boş bırak.')
      }),
      execute: async (input) => {
        const filePath = resolve(input.dosyaYolu.trim())
        const context = getToolContext()
        const key = `${context?.conversationId ?? 0}:${filePath.toLowerCase()}`

        if (!approvedReads.has(key)) {
          await requireApproval({
            toolName: 'belge_oku',
            label: 'Belge okunsun mu?',
            summary: filePath.split(/[\\/]/).pop() ?? filePath,
            details: filePath
          })
          approvedReads.add(key)
        }

        const document = await readDocumentPart(filePath, input.bolum ?? 1)
        return {
          dosya: document.name,
          bolum: document.part,
          toplamParca: document.partCount,
          karakterSayisi: document.charCount,
          metin: document.text
        }
      }
    })
  }
}

export default documentTools
