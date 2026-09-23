import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  ALLOWANCE_LABELS,
  REPEAT_LABELS,
  type AutomationInput,
  type RepeatRule,
  type RoutineAllowance
} from '@shared/api'
import Button from '../ui/Button'
import Select from '../ui/Select'
import { compactInputClass, inputClass } from '../../lib/styles'

interface NewAutomationFormProps {
  /** Başarılı olursa true döner; o zaman form temizlenir */
  onCreate: (input: AutomationInput) => Promise<boolean>
}

const REPEAT_OPTIONS = Object.entries(REPEAT_LABELS) as [RepeatRule, string][]
const ALLOWANCE_OPTIONS = Object.entries(ALLOWANCE_LABELS) as [RoutineAllowance, string][]

// Yeni rutin oluşturma formu: adı, ne yapacağı (serbest metin), saati, tekrarı ve izin seviyesi
function NewAutomationForm({ onCreate }: NewAutomationFormProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [timeOfDay, setTimeOfDay] = useState('09:00')
  const [repeat, setRepeat] = useState<RepeatRule>('none')
  const [allowance, setAllowance] = useState<RoutineAllowance>('none')
  const canSubmit = name.trim() !== '' && prompt.trim() !== '' && timeOfDay !== ''

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!canSubmit) return
    if (
      await onCreate({ name: name.trim(), prompt: prompt.trim(), timeOfDay, repeat, allowance })
    ) {
      setName('')
      setPrompt('')
      setTimeOfDay('09:00')
      setRepeat('none')
      setAllowance('none')
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="card space-y-3 p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Rutinin adı, ör. Sabah özeti"
        className={inputClass}
      />
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Çalışınca asistana ne söylensin? ör. Günlük özetimi hazırla ve sesli oku."
        rows={2}
        className={`${inputClass} resize-none`}
      />
      <div className="flex flex-wrap items-end gap-2">
        <input
          type="time"
          value={timeOfDay}
          onChange={(e) => setTimeOfDay(e.target.value)}
          aria-label="Saat"
          className={`${compactInputClass} w-28`}
        />
        <Select
          value={repeat}
          onChange={(e) => setRepeat(e.target.value as RepeatRule)}
          aria-label="Tekrar"
          className="w-36"
        >
          {REPEAT_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={allowance}
          onChange={(e) => setAllowance(e.target.value as RoutineAllowance)}
          aria-label="İzin seviyesi"
          className="w-36"
        >
          {ALLOWANCE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Button type="submit" disabled={!canSubmit} icon={Plus} className="ml-auto">
          Rutin kur
        </Button>
      </div>
    </form>
  )
}

export default NewAutomationForm
