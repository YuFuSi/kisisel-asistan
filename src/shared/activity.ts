// Masaüstü arkadaş: öndeki pencereden kullanıcının ne yaptığını tahmin eder.
// Sadece pencere başlığı ve program adı kullanılır (ekran görüntüsü yok); hepsi yerelde kalır.

export type ActivityKind =
  | 'video'
  | 'music'
  | 'game'
  | 'code'
  | 'meeting'
  | 'document'
  | 'chat'
  | 'browse'
  | 'jarvis'
  | 'desktop'
  | 'other'

export interface Activity {
  kind: ActivityKind
  /** Kısa açıklama (ör. video başlığı); yoksa boş */
  detail: string
  /** Öndeki pencere ekranı tamamen kaplıyor mu */
  fullscreen: boolean
}

const has = (text: string, words: string[]): boolean => words.some((word) => text.includes(word))

// Program adları (küçük harf, .exe'siz)
const CODE_APPS = [
  'code',
  'cursor',
  'devenv',
  'idea64',
  'pycharm64',
  'webstorm64',
  'windsurf',
  'zed',
  'studio64',
  'sublime_text',
  'notepad++'
]
const MUSIC_APPS = [
  'spotify',
  'itunes',
  'applemusic',
  'fizy',
  'deezer',
  'tidal',
  'foobar2000',
  'musicbee'
]
const VIDEO_APPS = [
  'vlc',
  'mpc-hc64',
  'mpc-be64',
  'potplayermini64',
  'netflix',
  'disney+',
  'max',
  'blutv',
  'gain',
  'tod',
  'exxen',
  'tvplus',
  'mpv'
]
const MEETING_APPS = ['zoom', 'teams', 'ms-teams', 'webex', 'skype']
const CHAT_APPS = ['discord', 'whatsapp', 'telegram', 'slack', 'signal', 'bip']
const DOCUMENT_APPS = [
  'winword',
  'excel',
  'powerpnt',
  'notepad',
  'canva',
  'obsidian',
  'notion',
  'acrord32',
  'soffice'
]
const BROWSERS = ['chrome', 'msedge', 'firefox', 'opera', 'brave', 'vivaldi', 'arc']
const GAME_LAUNCHERS = [
  'steam',
  'epicgameslauncher',
  'battle.net',
  'riotclientux',
  'ea',
  'gog galaxy'
]
const DESKTOP_APPS = ['explorer', '']

// Tarayıcı başlığındaki site ipuçları
const VIDEO_SITES = [
  'youtube',
  'netflix',
  'twitch',
  'disney+',
  'prime video',
  'blutv',
  'gain',
  'tod',
  'exxen',
  'tv+',
  'puhutv',
  'vimeo',
  'dizi',
  'film izle'
]
const MUSIC_SITES = ['spotify', 'youtube music', 'soundcloud', 'deezer', 'apple music', 'fizy']
const MEETING_SITES = ['google meet', 'meet.google', 'zoom meeting', 'teams']
const CHAT_SITES = ['whatsapp', 'bip', 'discord', 'telegram', 'instagram', 'messenger']
const DOCUMENT_SITES = [
  'google docs',
  'google dokümanlar',
  'google e-tablolar',
  'google sheets',
  'google slides',
  'google slaytlar',
  'canva',
  'notion',
  'overleaf'
]
const CODE_SITES = ['github', 'gitlab', 'stack overflow', 'stackoverflow', 'codepen']

// Tarayıcı başlığının sonundaki " - Google Chrome" gibi ekleri ve site adını atar
function cleanTitle(title: string): string {
  return title
    .replace(/\s[-–—]\s(google chrome|microsoft edge|mozilla firefox|opera|brave|vivaldi)$/i, '')
    .replace(/\s[-–—]\s(youtube|netflix|twitch|spotify)$/i, '')
    .replace(/^\(\d+\)\s*/, '')
    .trim()
}

export function classifyActivity(input: {
  process: string
  title: string
  fullscreen: boolean
}): Activity {
  const process = input.process.toLowerCase().replace(/\.exe$/, '')
  const title = input.title.toLowerCase()
  const result = (kind: ActivityKind, detail = ''): Activity => ({
    kind,
    detail,
    fullscreen: input.fullscreen
  })

  if (process === 'kisisel-asistan' || process === 'electron' || title === 'jarvis') {
    return result('jarvis')
  }
  if (DESKTOP_APPS.includes(process) && (title === '' || title === 'program manager')) {
    return result('desktop')
  }
  if (CODE_APPS.includes(process)) return result('code')
  if (MUSIC_APPS.includes(process)) return result('music', cleanTitle(input.title))
  if (VIDEO_APPS.includes(process)) return result('video', cleanTitle(input.title))
  if (MEETING_APPS.includes(process)) return result('meeting')
  if (CHAT_APPS.includes(process)) return result('chat')
  if (DOCUMENT_APPS.includes(process)) return result('document')

  if (BROWSERS.includes(process)) {
    // Sıra önemli: "YouTube Music" müziktir, "YouTube" videodur
    if (has(title, MUSIC_SITES)) return result('music', cleanTitle(input.title))
    if (has(title, VIDEO_SITES) || /(^|[^a-z0-9])max([^a-z0-9]|$)/.test(title)) {
      return result('video', cleanTitle(input.title))
    }
    if (has(title, MEETING_SITES)) return result('meeting')
    if (has(title, CHAT_SITES)) return result('chat')
    if (has(title, DOCUMENT_SITES)) return result('document')
    if (has(title, CODE_SITES)) return result('code')
    return result('browse')
  }

  if (GAME_LAUNCHERS.includes(process)) return result('other')
  // Bilinmeyen bir program tam ekransa büyük ihtimalle oyundur
  if (input.fullscreen) return result('game')
  return result('other')
}
