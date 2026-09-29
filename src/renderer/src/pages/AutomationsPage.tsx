import type { Automation, AutomationInput } from '@shared/api'
import AutomationItem from '../components/automations/AutomationItem'
import NewAutomationForm from '../components/automations/NewAutomationForm'
import Skeleton from '../components/ui/Skeleton'
import { errorMessage } from '../lib/errors'
import { useToast } from '../lib/toast'
import { useLiveData } from '../lib/useLiveData'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadAutomations = (): Promise<Automation[]> => window.api.automations.list()

// Planlama sayfasının "Rutinler" sekmesi (eskiden ayrı "Otomasyonlar" sayfasıydı)
function AutomationsPage(): React.JSX.Element {
  const { data, error } = useLiveData(loadAutomations, 'automations')
  const toast = useToast()

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action()
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }

  return (
    <div className="space-y-6">
      <NewAutomationForm
        onCreate={(input: AutomationInput) => run(() => window.api.automations.create(input))}
      />

      {!data && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      {data && data.length === 0 && (
        <p className="px-1 py-4 text-sm text-faint">Henüz bir rutin kurmadın.</p>
      )}
      <ul className="space-y-2">
        {data?.map((automation) => (
          <AutomationItem
            key={automation.id}
            automation={automation}
            onToggleEnabled={(enabled) =>
              void run(() => window.api.automations.update(automation.id, { enabled }))
            }
            onRunNow={() => run(() => window.api.automations.runNow(automation.id))}
            onDelete={() => void run(() => window.api.automations.remove(automation.id))}
          />
        ))}
      </ul>

      {error && <p className="text-sm text-negative select-text">{error}</p>}
    </div>
  )
}

export default AutomationsPage
