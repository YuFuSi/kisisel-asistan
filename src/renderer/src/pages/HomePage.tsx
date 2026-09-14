import { History } from 'lucide-react'
import ActivityList from '../components/activity/ActivityList'
import CommandBox from '../components/home/CommandBox'
import HomeCard from '../components/home/HomeCard'
import QuickAccess from '../components/home/QuickAccess'
import QuoteCard from '../components/home/QuoteCard'
import SystemStatusCard from '../components/home/SystemStatusCard'
import Orb from '../components/jarvis/Orb'
import { STATE_LABELS, useAssistantState } from '../lib/assistantState'
import { useClock } from '../lib/deviceStatus'
import type { PageId } from '../lib/pages'

interface HomePageProps {
  onNavigate: (page: PageId) => void
  /** Komut kutusundan gelen istek; yeni sohbette cevaplanır */
  onAsk: (text: string) => void
}

function greeting(hour: number): string {
  if (hour < 5) return 'İyi geceler'
  if (hour < 12) return 'Günaydın'
  if (hour < 18) return 'İyi günler'
  if (hour < 22) return 'İyi akşamlar'
  return 'İyi geceler'
}

// Jarvis ana ekranı: küre, komut kutusu, hızlı erişim ve sağda durum kartları
function HomePage({ onNavigate, onAsk }: HomePageProps): React.JSX.Element {
  const state = useAssistantState()
  const now = useClock(60_000)
  const busy = state !== 'idle'

  return (
    <div className="jarvis-backdrop h-full overflow-y-auto">
      <div className="mx-auto grid max-w-7xl gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex min-w-0 flex-col items-center">
          <Orb state={state} size={220} />
          <h1 className="-mt-2 text-4xl font-semibold tracking-tight text-ink">Jarvis</h1>
          <p className="mt-2 text-base text-muted">
            {greeting(now.getHours())}, nasıl yardımcı olabilirim?
          </p>
          <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs text-muted">
            <span
              className={`h-1.5 w-1.5 rounded-full ${busy ? 'animate-pulse bg-glow' : 'bg-positive'}`}
            />
            {STATE_LABELS[state]}
          </span>

          <div className="mt-8 flex w-full justify-center">
            <CommandBox onSubmit={onAsk} />
          </div>
          <div className="mt-12 w-full">
            <QuickAccess onNavigate={onNavigate} />
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <HomeCard title="Son işlemler" icon={History}>
            <ActivityList limit={5} compact />
          </HomeCard>
          <SystemStatusCard />
          <QuoteCard date={now} />
        </aside>
      </div>
    </div>
  )
}

export default HomePage
