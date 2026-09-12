import type { ToolSet } from 'ai'
import taskTools from './tasks'
import reminderTools from './reminders'
import noteTools from './notes'
import memoryTools from './memory'
import weatherTools from './weather'
import searchTools from './websearch'
import systemTools from './system'
import computerTools from './computer'
import gmailTools from './gmail'
import calendarTools from './calendar'
import clipboardTools from './clipboard'
import documentTools from './documents'
import briefTools from './brief'
import type { ToolModule } from './types'

// Asistanın kullanabildiği tüm yetenekler. Yeni bir modül eklemek için buraya eklemek yeterli.
const modules: ToolModule[] = [
  taskTools,
  reminderTools,
  noteTools,
  memoryTools,
  weatherTools,
  searchTools,
  systemTools,
  computerTools,
  gmailTools,
  calendarTools,
  clipboardTools,
  documentTools,
  briefTools
]

/** Şu an kullanılabilen araçlar; her cevapta yeniden hesaplanır (ör. Google sonradan bağlanabilir) */
export function getAssistantTools(): ToolSet {
  const available = modules.filter((m) => m.isAvailable?.() ?? true)
  return Object.assign({}, ...available.map((m) => m.tools))
}

export function toolLabel(name: string): string {
  for (const module of modules) {
    if (name in module.labels) return module.labels[name]
  }
  return name
}
