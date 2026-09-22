import type { ToolSet } from 'ai'
import { recordActivity } from '../activity'
import { describeToolInput } from '../lib/activityText'
import { summarizeToolOutput } from '../lib/toolHistory'
import taskTools from './tasks'
import automationTools from './automations'
import reminderTools from './reminders'
import noteTools from './notes'
import memoryTools from './memory'
import weatherTools from './weather'
import searchTools from './websearch'
import systemTools from './system'
import computerTools from './computer'
import windowTools from './windows'
import gmailTools from './gmail'
import calendarTools from './calendar'
import clipboardTools from './clipboard'
import documentTools from './documents'
import briefTools from './brief'
import visionTools from './vision'
import { requireApproval } from './approval'
import { getToolContext, runWithToolContext, type ToolCallState } from './context'
import { needsApproval } from './permissions'
import type { ToolModule } from './types'
import type { ActivityStatus, ToolRisk } from '../../shared/api'

// Asistanın kullanabildiği tüm yetenekler. Yeni bir modül eklemek için buraya eklemek yeterli.
export const modules: ToolModule[] = [
  taskTools,
  automationTools,
  reminderTools,
  noteTools,
  memoryTools,
  weatherTools,
  searchTools,
  systemTools,
  computerTools,
  windowTools,
  gmailTools,
  calendarTools,
  clipboardTools,
  documentTools,
  briefTools,
  visionTools
]

type ToolDefinition = ToolSet[string]

/**
 * Aracı izin kontrolü ve etkinlik kaydıyla sarar:
 * 1. Onay gerekiyorsa ve araç kendi onay kartını göstermiyorsa genel onay kartı gösterilir.
 * 2. Sonuç (başarılı, hata, reddedildi) etkinlik kaydına yazılır.
 */
function guardTool(
  name: string,
  definition: ToolDefinition,
  risk: ToolRisk,
  selfApproval: boolean
): ToolDefinition {
  const execute = definition.execute
  if (!execute) return definition

  const guarded: ToolDefinition['execute'] = async (input, options) => {
    const parent = getToolContext()
    // Bağlam yoksa (ör. testler) araç olduğu gibi çalışır
    if (!parent) return execute(input, options)

    const label = toolLabel(name)
    const call: ToolCallState = { name, risk }
    const record = (status: ActivityStatus, detail: string): void =>
      recordActivity({
        source: parent.source,
        name,
        label,
        summary: describeToolInput(input),
        detail,
        status,
        approval:
          call.approval === 'approved' || call.approval === 'auto' || call.approval === 'skipped'
            ? call.approval
            : null,
        conversationId: parent.conversationId
      })

    try {
      const output = await runWithToolContext({ ...parent, call }, async () => {
        const approvalNeeded =
          risk !== 'read' &&
          !selfApproval &&
          needsApproval({
            risk,
            source: parent.source,
            allowance: parent.allowance,
            external: parent.external
          })
        if (approvalNeeded) {
          await requireApproval({
            toolName: name,
            label: `${label} yapılsın mı?`,
            summary: describeToolInput(input) || label
          })
        }
        return await execute(input, options)
      })
      record('done', summarizeToolOutput(output))
      return output
    } catch (err) {
      const status: ActivityStatus =
        call.approval === 'denied' || call.approval === 'timeout' || call.approval === 'skipped'
          ? call.approval
          : 'error'
      record(status, err instanceof Error ? err.message : String(err))
      throw err
    }
  }

  return { ...definition, execute: guarded } as ToolDefinition
}

function guardModule(module: ToolModule): ToolSet {
  const tools: ToolSet = {}
  for (const [name, definition] of Object.entries(module.tools)) {
    tools[name] = guardTool(
      name,
      definition,
      module.risks[name] ?? 'dangerous',
      module.selfApproval?.includes(name) ?? false
    )
  }
  return tools
}

/** Şu an kullanılabilen araçlar; her cevapta yeniden hesaplanır (ör. Google sonradan bağlanabilir) */
export function getAssistantTools(): ToolSet {
  const available = modules.filter((m) => m.isAvailable?.() ?? true)
  return Object.assign({}, ...available.map(guardModule))
}

export function toolLabel(name: string): string {
  for (const module of modules) {
    if (name in module.labels) return module.labels[name]
  }
  return name
}
