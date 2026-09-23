import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ListTodo, MessageSquare, Brain, type LucideIcon } from 'lucide-react'

// Tur O: küre etrafında yörüngede dönen araç ikonları.
// Adım 1: sadece görsel (eğik elips yörünge, derinlik hissi).
// Adım 2: elin konumu (handPoint, merkeze göre px) yörüngedeki nesnelerle karşılaştırılıp
// yaklaşınca "hover" (büyüme + parlama) verilir. Henüz tıklama/seçme yok.

interface OrbitItem {
  icon: LucideIcon
  label: string
}

const ITEMS: OrbitItem[] = [
  { icon: ListTodo, label: 'Görevler' },
  { icon: Brain, label: 'Hafıza' },
  { icon: CalendarDays, label: 'Takvim' },
  { icon: MessageSquare, label: 'Asistan' }
]

const RADIUS_X = 180
const RADIUS_Y = 60
const DEGREES_PER_SECOND = 18
const HOVER_DISTANCE = 55

interface OrbitToolsProps {
  /** Elin merkeze göre px konumu (mirror düzeltilmiş); yoksa hiçbir nesne hover olmaz */
  handPoint?: { x: number; y: number } | null
}

export default function OrbitTools({ handPoint }: OrbitToolsProps): React.JSX.Element {
  const [angle, setAngle] = useState(0)
  const rafRef = useRef(0)
  const lastRef = useRef(0)

  useEffect(() => {
    function tick(now: number): void {
      if (lastRef.current === 0) lastRef.current = now
      const deltaSeconds = (now - lastRef.current) / 1000
      lastRef.current = now
      setAngle((a) => (a + DEGREES_PER_SECOND * deltaSeconds) % 360)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div className="relative h-[260px] w-[420px]">
      {ITEMS.map((item, index) => {
        const itemAngle = ((angle + index * (360 / ITEMS.length)) * Math.PI) / 180
        const x = Math.cos(itemAngle) * RADIUS_X
        const y = Math.sin(itemAngle) * RADIUS_Y
        // Öndeyken (sin > 0) büyük ve parlak, arkadayken küçük ve soluk: derinlik hissi
        const depth = (Math.sin(itemAngle) + 1) / 2
        const hovered = !!handPoint && Math.hypot(handPoint.x - x, handPoint.y - y) < HOVER_DISTANCE
        const scale = (0.7 + depth * 0.5) * (hovered ? 1.25 : 1)
        const opacity = hovered ? 1 : 0.4 + depth * 0.6
        const Icon = item.icon
        return (
          <div
            key={item.label}
            className="absolute left-1/2 top-1/2 flex flex-col items-center gap-1 transition-transform"
            style={{
              transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`,
              opacity,
              zIndex: hovered ? 200 : Math.round(depth * 100)
            }}
          >
            <div
              className={
                'flex h-12 w-12 items-center justify-center rounded-full border transition-colors ' +
                (hovered
                  ? 'border-accent bg-accent/30 text-accent shadow-float'
                  : 'border-accent/40 bg-accent/10 text-accent')
              }
            >
              <Icon size={22} />
            </div>
            <span className="text-xs text-muted">{item.label}</span>
          </div>
        )
      })}
      {handPoint && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-accent"
          style={{
            transform: `translate(-50%, -50%) translate(${handPoint.x}px, ${handPoint.y}px)`
          }}
        />
      )}
    </div>
  )
}
