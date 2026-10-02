import { useEffect, useRef, useState } from 'react'
import { Check, FileText, MessageSquare, X } from 'lucide-react'
import Orb from './components/jarvis/Orb'
import Pet from './components/jarvis/Pet'
import { useOrbPrefs } from './lib/orbPrefs'
import ResultCard from './components/jarvis/ResultCard'
import {
  respondToApproval,
  STATE_LABELS,
  useAssistantEmotion,
  useLastOutcome,
  usePendingApprovals,
  useResultCards,
  useWorkSteps,
  type Outcome
} from './lib/assistantState'
import type { OutcomeKind } from './lib/outcome'
import { toggleRemoteVoice, useRemoteAssistant } from './lib/remoteAssistant'
import { currentStep } from './lib/workSteps'

// Sonuç kartı bu kadar süre görünür kalır
const OUTCOME_MS = 8000

const OUTCOME_TEXT: Record<OutcomeKind, string> = {
  completed: 'Tamamlandı',
  partial: 'Kısmen tamamlandı: bir adım hata verdi',
  rejected: 'Onaylanmadı, işlem yapılmadı',
  timeout: 'Onay süresi doldu, işlem yapılmadı',
  stopped: 'Durduruldu',
  error: 'Bir hata oldu'
}

// Düz sohbet cevapları çentikte gösterilmez; sadece araçla yapılan işler ve sorunlar
function worthShowing(outcome: Outcome | null): boolean {
  if (!outcome) return false
  return outcome.kind !== 'completed' || outcome.toolCount > 0
}

// Jarvis Çentiği: ekranın üst ortasında gözlü damla. Boştayken küçücük; bir iş sürerken ne
// yaptığını yazar, onay gerekince aşağı açılıp düğmeleri gösterir, iş bitince kısa bir sonuç verir.
function NotchApp(): React.JSX.Element {
  const { state, sessionActive, notice } = useRemoteAssistant()
  const emotion = useAssistantEmotion()
  const { character } = useOrbPrefs()
  const steps = useWorkSteps()
  const approvals = usePendingApprovals()
  const outcome = useLastOutcome()
  const cards = useResultCards()
  const [hover, setHover] = useState(false)
  // Üstüne belge sürükleniyor: çentik açılır ve "bırak" der
  const [dragging, setDragging] = useState(false)
  const pillRef = useRef<HTMLDivElement>(null)
  // Son sonuç kartı: yeni sonuç gelince görünür, birkaç saniye sonra kapanır
  const [shownOutcome, setShownOutcome] = useState<Outcome | null>(null)

  useEffect(() => {
    if (!worthShowing(outcome)) return
    const show = setTimeout(() => setShownOutcome(outcome), 0)
    const hide = setTimeout(() => setShownOutcome(null), OUTCOME_MS)
    return () => {
      clearTimeout(show)
      clearTimeout(hide)
    }
  }, [outcome])

  const approval = approvals[0]
  const running = currentStep(steps)
  const busy = state !== 'idle'
  // Onay beklerken araç "çalışıyor" görünse de asıl durum beklemek
  const status =
    running && state !== 'approval' ? `${running.label} çalışıyor` : STATE_LABELS[state]

  const expanded = Boolean(approval) || Boolean(shownOutcome) || hover || dragging
  const targetWidth = expanded ? 420 : busy ? 220 : 104

  // Pencere her zaman içerik kadar: genişlerken hedef genişlik hemen istenir (içerik kesilmesin),
  // daralırken animasyon boyunca ölçülen boy izlenir
  useEffect(() => {
    const pill = pillRef.current
    if (!pill) return
    const report = (): void =>
      window.api.notch.resize(Math.max(pill.offsetWidth, targetWidth), pill.offsetHeight)
    report()
    const observer = new ResizeObserver(report)
    observer.observe(pill)
    return () => observer.disconnect()
  }, [targetWidth])

  function handleDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setDragging(false)
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => window.api.documents.pathForFile(file))
      .filter(Boolean)
    if (paths.length > 0) window.api.notch.dropFiles(paths)
  }

  return (
    <div className="flex h-full w-full justify-center">
      <div
        ref={pillRef}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={handleDrop}
        style={{ width: targetWidth }}
        className="flex h-fit flex-col overflow-hidden rounded-b-[22px] border border-t-0 border-line bg-app/95 transition-[width] duration-200 ease-out"
      >
        <div className={`flex items-center gap-2 px-3 ${character !== 'orb' ? 'h-14' : 'h-11'}`}>
          {character !== 'orb' ? (
            // Pet karakter: çentikte küçük cam robot
            <span className="mx-2 flex h-14 shrink-0 items-end pb-0.5">
              <Pet
                variant={character}
                state={state}
                emotion={emotion}
                size={36}
                compact
                hungry={dragging}
                activity={running?.name ?? null}
                onClick={() => toggleRemoteVoice(sessionActive)}
                label={sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
              />
            </span>
          ) : (
            <button
              onClick={() => toggleRemoteVoice(sessionActive)}
              aria-label={sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
              title={sessionActive ? 'Sesli sohbeti bitir' : 'Jarvis ile konuş'}
              className="relative -my-2 h-11 w-11 shrink-0 cursor-pointer rounded-full"
            >
              <span
                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 [&_canvas]:max-w-none"
                style={{ width: 60, height: 60 }}
              >
                <Orb state={state} size={60} emotion={emotion} steps={steps} notice={notice} />
              </span>
            </button>
          )}
          {(busy || expanded) && (
            <span role="status" aria-live="polite" className="min-w-0 truncate text-xs text-muted">
              {busy ? status : 'Jarvis hazır · konuşmak için tıkla'}
            </span>
          )}
        </div>

        {dragging && (
          <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-sm text-ink">
            <FileText className="h-4 w-4 text-accent" aria-hidden />
            Bırak: Jarvis belgeyi yeni sohbete eklesin
          </div>
        )}

        {approval && (
          <div className="animate-fade space-y-2 border-t border-line px-4 py-3">
            <div className="text-xs text-caution">
              Jarvis onayını bekliyor
              {approvals.length > 1 && ` · ${approvals.length} işlem`}
            </div>
            <div className="text-sm font-medium text-ink">{approval.approval.label}</div>
            <div className="text-sm text-muted">{approval.approval.summary}</div>
            {approval.approval.details && (
              <div className="truncate text-xs text-faint" title={approval.approval.details}>
                {approval.approval.details}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => respondToApproval(approval.approval.id, true)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-app hover:bg-accent-hover"
              >
                <Check className="h-4 w-4" />
                Onayla
              </button>
              <button
                onClick={() => respondToApproval(approval.approval.id, false)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm text-ink hover:bg-elevated"
              >
                <X className="h-4 w-4" />
                Reddet
              </button>
            </div>
          </div>
        )}

        {!approval && shownOutcome && cards.length > 0 && (
          <div className="border-t border-line px-3 pt-3">
            <ResultCard card={cards[cards.length - 1]} />
          </div>
        )}
        {!approval && shownOutcome && (
          <div className="animate-fade flex items-center gap-3 border-t border-line px-4 py-3">
            <span
              className={`text-sm ${
                shownOutcome.kind === 'completed'
                  ? 'text-positive'
                  : shownOutcome.kind === 'error' || shownOutcome.kind === 'partial'
                    ? 'text-negative'
                    : 'text-muted'
              }`}
            >
              {OUTCOME_TEXT[shownOutcome.kind]}
              {shownOutcome.kind === 'completed' &&
                shownOutcome.toolCount > 1 &&
                ` · ${shownOutcome.toolCount} adım`}
            </span>
            <button
              onClick={() => void window.api.notch.navigate('chat')}
              className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs text-accent hover:text-accent-hover"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Sohbette aç
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotchApp
