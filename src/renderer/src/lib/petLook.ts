import {
  Bell,
  CalendarDays,
  CloudSun,
  FileText,
  FolderSearch,
  Globe,
  ListChecks,
  Mail,
  MonitorSmartphone,
  NotebookPen,
  Sparkles,
  type LucideIcon
} from 'lucide-react'

// Pet karakterinin görünüm sabitleri: ruh hâli, anten rengi, araç simgeleri (prototip "Jarvis Cam")

export type PetMood =
  'idle' | 'listen' | 'think' | 'work' | 'speak' | 'approval' | 'happy' | 'sad' | 'sleep'

/** Anten ucunun rengi: durum ışığı */
export const ANTENNA_COLOR: Record<PetMood, string> = {
  idle: '#a3b0ff',
  listen: '#b9c3ff',
  think: '#a3b0ff',
  work: '#9fd4ff',
  speak: '#b9c3ff',
  approval: '#f6b84b',
  happy: '#5fd9a8',
  sad: '#ef7d7d',
  sleep: '#6b7180'
}

// Çalışan aracın adına göre ekranda gösterilecek simge (ilk eşleşen önek kazanır)
const TOOL_ICONS: [string, LucideIcon][] = [
  ['hava', CloudSun],
  ['takvim', CalendarDays],
  ['etkinlik', CalendarDays],
  ['gorev', ListChecks],
  ['hatirlatma', Bell],
  ['rutin', Bell],
  ['web', Globe],
  ['url', Globe],
  ['dosya', FolderSearch],
  ['belge', FileText],
  ['eposta', Mail],
  ['taslak', Mail],
  ['not', NotebookPen],
  ['hafiza', Sparkles],
  ['gecmiste', Sparkles],
  ['uygulama', MonitorSmartphone],
  ['pencere', MonitorSmartphone],
  ['ekrani', MonitorSmartphone]
]

export function toolIcon(toolName: string | null | undefined): LucideIcon | null {
  if (!toolName) return null
  return TOOL_ICONS.find(([prefix]) => toolName.startsWith(prefix))?.[1] ?? null
}

export type HandGesture = PetMood | 'wave'
