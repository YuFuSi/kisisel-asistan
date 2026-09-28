import { promises as fs } from 'node:fs'
import { basename, extname } from 'node:path'
import { tool } from 'ai'
import { z } from 'zod'
import { app, shell } from 'electron'
import { findApp, launchApp, listStartApps, suggestApps } from '../lib/apps'
import { searchFiles } from '../lib/files'
import { assertWithinRoot } from '../lib/safePath'
import { requireApproval } from './approval'
import type { ToolModule } from './types'

// dosya_ac ile açılmayacak uzantılar: açmak yerine program/betik olarak çalışırlar
const BLOCKED_OPEN_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.ps1',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.scr',
  '.pif',
  '.lnk',
  '.url',
  '.hta',
  '.cpl',
  '.reg',
  '.jar',
  '.appref-ms'
])

// Dosya aramasında taranan kullanıcı klasörleri
function userFolders(): string[] {
  const names = ['desktop', 'documents', 'downloads', 'pictures', 'music', 'videos'] as const
  const folders: string[] = []
  for (const name of names) {
    try {
      folders.push(app.getPath(name))
    } catch {
      // Bu klasör tanımlı değilse atla
    }
  }
  return folders
}

const computerTools: ToolModule = {
  risks: { url_ac: 'write', uygulama_ac: 'dangerous', dosya_bul: 'read', dosya_ac: 'dangerous' },
  selfApproval: ['uygulama_ac', 'dosya_ac'],
  labels: {
    url_ac: 'Adres açma',
    uygulama_ac: 'Uygulama açma',
    dosya_bul: 'Dosya arama',
    dosya_ac: 'Dosya açma'
  },
  tools: {
    url_ac: tool({
      description: 'Verilen web adresini kullanıcının varsayılan tarayıcısında açar.',
      inputSchema: z.object({
        adres: z.string().describe('http:// veya https:// ile başlayan tam adres')
      }),
      execute: async (input) => {
        const url = input.adres.trim()
        if (!/^https?:\/\//i.test(url)) {
          throw new Error('Sadece http:// veya https:// ile başlayan adresler açılabilir.')
        }
        await shell.openExternal(url)
        return { acildi: true, adres: url }
      }
    }),

    uygulama_ac: tool({
      description:
        'Bilgisayardaki bir uygulamayı açar. Uygulama, Windows Başlat menüsündeki uygulama listesinde aranır. Kullanıcıdan onay istenir.',
      inputSchema: z.object({
        ad: z.string().describe('Uygulama adı, ör. "Not Defteri", "Chrome", "Hesap Makinesi"')
      }),
      execute: async (input) => {
        const apps = await listStartApps()
        const found = findApp(apps, input.ad)
        if (!found) {
          const suggestions = suggestApps(apps, input.ad)
          const extra = suggestions.length ? ` Şunlar olabilir: ${suggestions.join(', ')}.` : ''
          throw new Error(`"${input.ad}" adında bir uygulama bulunamadı.${extra}`)
        }

        await requireApproval({
          toolName: 'uygulama_ac',
          label: 'Uygulama açılsın mı?',
          summary: found.ad,
          details: found.appId
        })

        await launchApp(found.appId)
        return { acildi: true, uygulama: found.ad }
      }
    }),

    dosya_bul: tool({
      description:
        'Kullanıcının klasörlerinde (Masaüstü, Belgeler, İndirilenler, Resimler, Müzik, Videolar) dosya adına göre arama yapar.',
      inputSchema: z.object({
        ad: z.string().describe('Dosya adının bir parçası, ör. "fatura" veya "sunum pptx"')
      }),
      execute: async (input) => {
        const files = await searchFiles({ query: input.ad, roots: userFolders(), limit: 15 })
        return { bulunan: files.length, dosyalar: files }
      }
    }),

    dosya_ac: tool({
      description:
        'Bir dosyayı veya klasörü varsayılan programıyla açar. Tam yolu bilmiyorsan önce dosya_bul aracını kullan. Kullanıcıdan onay istenir.',
      inputSchema: z.object({
        yol: z.string().describe('Dosyanın veya klasörün tam yolu')
      }),
      execute: async (input) => {
        const target = input.yol.trim()

        // path.relative ile gerçek alt yol kontrolü (salt "startsWith" kardeş klasöre kanar,
        // ör. "C:\Users\ysfll2\..."); realpath symlink/junction ile kaçışı da engeller.
        // Varlık kontrolünden önce yapılır: klasör dışındaki yolların varlığı sızmasın.
        const home = app.getPath('home')
        const realTarget = await assertWithinRoot(
          home,
          target,
          'Bu yolda dosya bulunamadı ya da yol kullanıcı klasörünün dışında (güvenlik için sadece kullanıcı klasörü açılabilir).'
        )
        const stat = await fs.stat(realTarget)

        // Program/betik dosyaları açılmak yerine çalışır; web/e-posta içeriğinden gelen bir
        // yönlendirmeyle (prompt injection) tek tıklık onayla program çalıştırılmasın
        if (stat.isFile() && BLOCKED_OPEN_EXTENSIONS.has(extname(realTarget).toLowerCase())) {
          throw new Error(
            'Güvenlik için program ve betik dosyaları (.exe, .bat, .ps1 vb.) açılamaz. Kullanıcı kendisi açabilir.'
          )
        }

        await requireApproval({
          toolName: 'dosya_ac',
          label: stat.isDirectory() ? 'Klasör açılsın mı?' : 'Dosya açılsın mı?',
          summary: basename(realTarget),
          details: realTarget
        })

        const error = await shell.openPath(realTarget)
        if (error) throw new Error(`Açılamadı: ${error}`)
        return { acildi: true, yol: realTarget }
      }
    })
  }
}

export default computerTools
