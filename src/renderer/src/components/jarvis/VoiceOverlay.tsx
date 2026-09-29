import { useEffect } from 'react'
import { MessageSquare, Square } from 'lucide-react'
import Orb from './Orb'
import Button from '../ui/Button'
import {
  STATE_LABELS,
  useAssistantEmotion,
  useAssistantState,
  useNoticeSeq,
  useWorkSteps
} from '../../lib/assistantState'
import { toggleVoiceSession, useVoice } from '../../lib/voiceClient'

// Altyazıda cevabın sadece son kısmı gösterilir (sinema altyazısı gibi); tamamı sohbette durur
const CAPTION_TAIL = 240

function tail(text: string): string {
  if (text.length <= CAPTION_TAIL) return text
  const cut = text.slice(-CAPTION_TAIL)
  const space = cut.indexOf(' ')
  return `…${space >= 0 ? cut.slice(space + 1) : cut}`
}

interface VoiceOverlayProps {
  onOpenConversation: (conversationId: number) => void
}

// "Her yerde Jarvis": Ana Sayfa dışındayken sesli sohbet başlarsa sayfa kararır, ortada büyük
// küre ve altyazılar belirir. Esc veya "Bitir" sohbeti kapatır; çalışan araçlar kart olarak görünür.
function VoiceOverlay({ onOpenConversation }: VoiceOverlayProps): React.JSX.Element | null {
  const voice = useVoice()
  const state = useAssistantState()
  const emotion = useAssistantEmotion()
  const steps = useWorkSteps()
  const notice = useNoticeSeq()

  useEffect(() => {
    if (!voice.sessionActive) return
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') toggleVoiceSession()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [voice.sessionActive])

  if (!voice.sessionActive) return null
  const conversationId = voice.conversationId

  return (
    <div className="animate-fade absolute inset-0 z-40 flex flex-col items-center justify-center bg-app/85 px-8 backdrop-blur-md">
      <button
        onClick={toggleVoiceSession}
        aria-label="Sesli sohbeti bitir"
        title="Sesli sohbeti bitir"
        className="animate-orb-in cursor-pointer rounded-full"
      >
        <Orb state={state} size={340} emotion={emotion} steps={steps} notice={notice} />
      </button>

      <p className="-mt-6 text-xs tracking-wide text-faint">{STATE_LABELS[state]}</p>

      {steps.length > 0 && (
        <div className="mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
          {steps.map((step) => (
            <span
              key={step.id}
              className={`animate-fade rounded-full border px-3 py-1 text-xs ${
                step.status === 'running'
                  ? 'border-accent/50 text-ink'
                  : step.status === 'error'
                    ? 'border-negative/50 text-negative'
                    : 'border-line text-muted'
              }`}
            >
              {step.label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 min-h-24 w-full max-w-3xl space-y-3 text-center select-text">
        {voice.userCaption && <p className="text-sm text-muted">“{voice.userCaption}”</p>}
        {voice.assistantCaption && (
          <p className="text-2xl leading-snug font-medium tracking-tight text-ink">
            {tail(voice.assistantCaption)}
          </p>
        )}
        {(voice.micError ?? voice.error) && (
          <p className="text-xs text-negative">{voice.micError ?? voice.error}</p>
        )}
      </div>

      <div className="mt-6 flex gap-4">
        {conversationId !== null && (
          <Button
            variant="ghost"
            size="sm"
            icon={MessageSquare}
            onClick={() => {
              toggleVoiceSession()
              onOpenConversation(conversationId)
            }}
          >
            Sohbette aç
          </Button>
        )}
        <Button variant="ghost" size="sm" icon={Square} onClick={toggleVoiceSession}>
          Bitir (Esc)
        </Button>
      </div>
    </div>
  )
}

export default VoiceOverlay
