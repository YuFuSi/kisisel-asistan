import { tool } from 'ai'
import { z } from 'zod'
import { createNote, searchNotes } from '../data/notes'
import { notifyDataChanged } from '../events'
import type { ToolModule } from './types'

const MAX_CONTENT = 800

const noteTools: ToolModule = {
  risks: { not_kaydet: 'write', notlarda_ara: 'read' },
  labels: {
    not_kaydet: 'Not kaydetme',
    notlarda_ara: 'Notlarda arama'
  },
  tools: {
    not_kaydet: tool({
      description:
        'Kullanıcının notlarına yeni bir not kaydeder. Listeler, fikirler, uzun bilgiler için kullan.',
      inputSchema: z.object({
        baslik: z.string().describe('Notun kısa başlığı'),
        icerik: z.string().describe('Notun içeriği')
      }),
      execute: async ({ baslik, icerik }) => {
        const note = createNote({ title: baslik, content: icerik })
        notifyDataChanged('notes')
        return { id: note.id, baslik: note.title }
      }
    }),

    notlarda_ara: tool({
      description:
        'Kullanıcının notlarında kelimeyle arama yapar. Kullanıcı daha önce kaydettiği bir şeyi sorarsa kullan.',
      inputSchema: z.object({
        sorgu: z.string().describe('Aranacak kelime veya kelimeler')
      }),
      execute: async ({ sorgu }) => ({
        notlar: searchNotes(sorgu).map((note) => ({
          id: note.id,
          baslik: note.title || 'Başlıksız not',
          icerik:
            note.content.length > MAX_CONTENT
              ? `${note.content.slice(0, MAX_CONTENT)}…`
              : note.content
        }))
      })
    })
  }
}

export default noteTools
