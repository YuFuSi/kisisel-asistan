import { useState } from 'react'
import Button from '../components/ui/Button'
import { Workflow } from 'lucide-react'
import type { Automation, AutomationInput } from '@shared/api'
import AutomationItem from '../components/automations/AutomationItem'
import NewAutomationForm from '../components/automations/NewAutomationForm'
import EmptyState from '../components/ui/EmptyState'
import InlineError from '../components/ui/InlineError'
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
  const [creating, setCreating] = useState(false)

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
      <Button variant="secondary" onClick={() => setCreating(!creating)} aria-expanded={creating}>
        {creating ? 'Vazgeç' : 'Yeni rutin'}
      </Button>
      {creating && (
        <NewAutomationForm
          onCreate={async (input: AutomationInput) => {
            const ok = await run(() => window.api.automations.create(input))
            if (ok) setCreating(false)
            return ok
          }}
        />
      )}

      {!data && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      {data && data.length === 0 && (
        <EmptyState
          compact
          icon={Workflow}
          title="İlk rutinini kur"
          description="Jarvis belirlediğin saatte senin yerine bir işi yapsın: sabah özeti, akşam raporu, haftalık temizlik gibi."
        />
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

      <InlineError message={error} />
    </div>
  )
}

export default AutomationsPage
