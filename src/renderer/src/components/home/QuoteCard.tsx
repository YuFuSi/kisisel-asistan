import { Sparkles } from 'lucide-react'

// Her gün sırayla biri gösterilir
const QUOTES = [
  'Küçük adımlar da ileri götürür.',
  'Odaklandığın şey büyür.',
  'Plan yapmak, zamana yön vermektir.',
  'Her tamamlanan görev bir sonrakine güç verir.',
  'Mükemmeli bekleme; başla ve geliştir.',
  'Ara vermek de işin bir parçası.',
  'Bir listeye yazılan dert yarı yarıya hafifler.',
  'Zor olanı önce yap, günün geri kalanı hafifler.',
  'Merak etmek öğrenmenin ilk adımıdır.',
  'Yavaş ama düzenli ilerlemek, hızlı ama dağınık koşmaktan iyidir.',
  'Bugün attığın tohum, yarının gölgesidir.',
  'Daha iyi bir sen, her gün biraz daha mümkün.'
]

interface QuoteCardProps {
  date: Date
}

function QuoteCard({ date }: QuoteCardProps): React.JSX.Element {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86_400_000
  )
  const quote = QUOTES[dayOfYear % QUOTES.length]

  return (
    <section className="glass-card relative overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-accent/25 via-transparent to-glow/10" />
      <Sparkles className="relative h-4 w-4 text-glow" />
      <p className="relative mt-3 text-[15px] leading-relaxed text-ink italic">{quote}</p>
      <p className="relative mt-3 text-xs text-muted">— Jarvis</p>
    </section>
  )
}

export default QuoteCard
