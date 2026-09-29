import { useEffect, useRef, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  ListTodo,
  MessageSquare,
  Brain,
  Settings,
  type LucideIcon
} from 'lucide-react'
import type { PageId } from '../../lib/pages'
import { projectRing } from '../../lib/orbit3d'

// Tur O: küre etrafında yörüngede dönen araç ikonları.
// Adım 1: sadece görsel (önce sahte sin/cos elips, sonra gerçek Three.js perspektif projeksiyonu).
// Adım 2: elin konumu (handPoint) yörüngedeki nesnelerle karşılaştırılıp yaklaşınca hover verilir.
// Adım 3: hover'dayken pinch yapılırsa o nesnenin gerçek sayfasına geçilir (onSelect).

interface OrbitItem {
  page: PageId
  icon: LucideIcon
  label: string
}

const ITEMS: OrbitItem[] = [
  // Menüyle aynı 6 hedef (tasarım turu); 8 simge 3B halkada üst üste biniyordu
  { page: 'tasks', icon: ListTodo, label: 'Planlama' },
  { page: 'notes', icon: Brain, label: 'Hafıza' },
  { page: 'calendar', icon: CalendarDays, label: 'Takvim' },
  { page: 'chat', icon: MessageSquare, label: 'Asistan' },
  { page: 'analytics', icon: BarChart3, label: 'Analizler' },
  { page: 'settings', icon: Settings, label: 'Ayarlar' }
]

const DEFAULT_RADIUS_X = 180
const DEFAULT_RADIUS_Y = 60
const DEFAULT_HOVER_DISTANCE = 55
// Histerezis: el tam sınırda dururken hover'ın kare-kare açılıp kapanmasını (ikon titremesi)
// önlemek için çıkış eşiği girişten biraz daha geniş tutuluyor
const HOVER_EXIT_MARGIN = 12
const DEGREES_PER_SECOND = 18

interface ItemLayout {
  item: OrbitItem
  x: number
  y: number
  depth: number
  hovered: boolean
}

function layoutItems(
  angle: number,
  handPoint: { x: number; y: number } | null | undefined,
  radiusX: number,
  radiusY: number,
  hoverDistance: number,
  currentHoveredPage: PageId | null
): ItemLayout[] {
  const projected = projectRing(ITEMS.length, angle)
  return ITEMS.map((item, index) => {
    const p = projected[index]
    const x = p.x * radiusX
    const y = p.y * radiusY
    // Zaten hover'da olan nesne için eşik biraz genişletilir (histerezis) — sınırdaki titreme önlenir
    const threshold =
      item.page === currentHoveredPage ? hoverDistance + HOVER_EXIT_MARGIN : hoverDistance
    const hovered = !!handPoint && Math.hypot(handPoint.x - x, handPoint.y - y) < threshold
    return { item, x, y, depth: p.depth, hovered }
  })
}

interface OrbitToolsProps {
  /** Elin merkeze göre px konumu (mirror düzeltilmiş); yoksa hiçbir nesne hover olmaz */
  handPoint?: { x: number; y: number } | null
  /** Pinch yapılan anda true olur; hover'daki nesne varsa onSelect ile bildirilir */
  pinching?: boolean
  onSelect?: (page: PageId) => void
  /** Hover'daki nesne değişince bildirir (null = hiçbiri); ör. boşlukta pinch'in başka bir işe
   *  (pencere sürükleme gibi) ayrılabilmesi için */
  onHoverChange?: (page: PageId | null) => void
  radiusX?: number
  radiusY?: number
  hoverDistance?: number
}

export default function OrbitTools({
  handPoint,
  pinching = false,
  onSelect,
  onHoverChange,
  radiusX = DEFAULT_RADIUS_X,
  radiusY = DEFAULT_RADIUS_Y,
  hoverDistance = DEFAULT_HOVER_DISTANCE
}: OrbitToolsProps): React.JSX.Element {
  const [angle, setAngle] = useState(0)
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  // Bu bileşen açılırken (ör. Ana Sayfa yüklenirken el kontrolü zaten açıksa) el hâlâ pinch
  // durumunda olabilir; başlangıcı false yapmak bu devam eden pinch'i "yeni" sanıp hover'da
  // hiçbir şey yokken bile yanlışlıkla bir sayfaya atlayabilirdi (TaskOrbit'te bulunan aynı hata)
  const wasPinching = useRef(pinching)
  const [stableHoveredPage, setStableHoveredPage] = useState<PageId | null>(null)

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

  const layout = layoutItems(angle, handPoint, radiusX, radiusY, hoverDistance, stableHoveredPage)
  const hoveredPage = layout.find((l) => l.hovered)?.item.page ?? null

  // Pinch'in "başladığı" an (false -> true geçişi) hover'daki nesneyi seçer; basılı tutmak
  // tekrar tekrar tetiklemesin diye kenar (edge) algılanıyor
  useEffect(() => {
    if (pinching && !wasPinching.current && hoveredPage) {
      onSelect?.(hoveredPage)
    }
    wasPinching.current = pinching
  }, [pinching, hoveredPage, onSelect])

  useEffect(() => {
    void Promise.resolve().then(() => setStableHoveredPage(hoveredPage))
    onHoverChange?.(hoveredPage)
  }, [hoveredPage, onHoverChange])

  return (
    <div className="relative" style={{ width: (radiusX + 60) * 2, height: (radiusY + 60) * 2 }}>
      {layout.map(({ item, x, y, depth, hovered }) => {
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
          className={
            'pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 rounded-full transition-colors ' +
            (pinching ? 'bg-positive' : 'bg-accent')
          }
          style={{
            transform: `translate(-50%, -50%) translate(${handPoint.x}px, ${handPoint.y}px)`
          }}
        />
      )}
    </div>
  )
}
