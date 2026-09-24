import { useEffect, useRef, useState } from 'react'
import { ListTodo } from 'lucide-react'
import type { Task } from '@shared/api'
import { projectRing } from '../../lib/orbit3d'

// Tur O: yörüngedeki sabit araç ikonları yerine GERÇEK görev verisi — bugünün bekleyen
// görevleri küre etrafında kartlar olarak döner. Bir kartı kavrayıp (pinch) küreye doğru
// sürükleyip bırakınca görev gerçekten tamamlanır (window.api.tasks.update). Sadece bir menü
// gezinme değil, gerçek veriyle doğrudan etkileşim.
const MAX_TASKS = 6
const RADIUS_X = 200
const RADIUS_Y = 70
const HOVER_DISTANCE = 55
// OrbitTools'taki ile aynı histerezis: sınırdaki titremeyi önler
const HOVER_EXIT_MARGIN = 12
const DEGREES_PER_SECOND = 14
// Kartı küreye bu kadar yaklaştırıp bırakınca "tamamlandı" sayılır
const DROP_ZONE_DISTANCE = 90

interface HandPoint {
  x: number
  y: number
}

interface TaskOrbitProps {
  tasks: Task[]
  handPoint?: HandPoint | null
  pinching?: boolean
  onComplete: (id: number) => void
  /** Hiçbir kart hover'da değilken pinch yapılırsa çağrılır — "geri dön" jesti */
  onExit?: () => void
}

export default function TaskOrbit({
  tasks,
  handPoint,
  pinching = false,
  onComplete,
  onExit
}: TaskOrbitProps): React.JSX.Element {
  const pending = tasks.filter((t) => !t.doneAt).slice(0, MAX_TASKS)
  const [angle, setAngle] = useState(0)
  const rafRef = useRef(0)
  const lastRef = useRef(0)
  // "Görevler" seçilirken kullanılan pinch hâlâ basılıyken bu bileşen açılıyor; başlangıç
  // değeri false olsaydı bu devam eden pinch "yeni bir pinch" sanılıp anında bir kartı kavrar
  // ya da (hiçbir şey hover'da değilse) hemen onExit tetiklerdi. Gerçek başlangıç durumuyla
  // eşleştirilerek sadece GERÇEK bırak->tekrar-bas geçişleri jest sayılır.
  const wasPinching = useRef(pinching)
  const [grabbedId, setGrabbedId] = useState<number | null>(null)
  const grabbedNearOrb = useRef(false)
  const [stableHoveredId, setStableHoveredId] = useState<number | null>(null)

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

  const projected = projectRing(pending.length || 1, angle)
  const layout = pending.map((task, index) => {
    const p = projected[index]
    const x = p.x * RADIUS_X
    const y = p.y * RADIUS_Y
    const threshold =
      task.id === stableHoveredId ? HOVER_DISTANCE + HOVER_EXIT_MARGIN : HOVER_DISTANCE
    const hovered =
      grabbedId === null && !!handPoint && Math.hypot(handPoint.x - x, handPoint.y - y) < threshold
    return { task, x, y, depth: p.depth, hovered }
  })
  const hoveredId = layout.find((l) => l.hovered)?.task.id ?? null

  useEffect(() => {
    void Promise.resolve().then(() => setStableHoveredId(hoveredId))
  }, [hoveredId])

  // Pinch'in başladığı an: hover'daki kartı kavra; hiçbir şey hover'da değilse "geri dön"
  useEffect(() => {
    if (pinching && !wasPinching.current) {
      const toGrab = hoveredId
      void Promise.resolve().then(() => {
        if (toGrab !== null) setGrabbedId(toGrab)
        else onExit?.()
      })
    }
    if (!pinching && grabbedId !== null) {
      // Bırakılan an küreye yeterince yakınsa tamamlandı sayılır
      const completedId = grabbedNearOrb.current ? grabbedId : null
      void Promise.resolve().then(() => {
        if (completedId !== null) onComplete(completedId)
        setGrabbedId(null)
      })
    }
    wasPinching.current = pinching
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinching, hoveredId])

  // Kavranmışken elin küreye (merkeze) yakınlığını sürekli takip et (sadece efektte okunur/yazılır)
  useEffect(() => {
    if (grabbedId === null || !handPoint) return
    grabbedNearOrb.current = Math.hypot(handPoint.x, handPoint.y) < DROP_ZONE_DISTANCE
  }, [grabbedId, handPoint])

  return (
    <div className="relative" style={{ width: (RADIUS_X + 70) * 2, height: (RADIUS_Y + 70) * 2 }}>
      {layout.map(({ task, x, y, depth, hovered }) => {
        const grabbed = grabbedId === task.id
        // Kavranmışken kart elin altına gider, aksi halde yörüngedeki yerinde durur
        const posX = grabbed && handPoint ? handPoint.x : x
        const posY = grabbed && handPoint ? handPoint.y : y
        // Ref render sırasında okunmaz; drop bölgesi rengi doğrudan el konumundan hesaplanır
        const nearDrop =
          grabbed && !!handPoint && Math.hypot(handPoint.x, handPoint.y) < DROP_ZONE_DISTANCE
        const scale = grabbed ? 1.3 : (0.7 + depth * 0.5) * (hovered ? 1.2 : 1)
        const opacity = grabbed ? 1 : hovered ? 1 : 0.4 + depth * 0.6
        return (
          <div
            key={task.id}
            className="absolute left-1/2 top-1/2 flex max-w-[110px] flex-col items-center gap-1"
            style={{
              transform: `translate(-50%, -50%) translate(${posX}px, ${posY}px) scale(${scale})`,
              opacity,
              zIndex: grabbed ? 300 : hovered ? 200 : Math.round(depth * 100),
              transition: grabbed ? 'none' : 'transform 0.2s ease-out'
            }}
          >
            <div
              className={
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ' +
                (nearDrop
                  ? 'border-positive bg-positive/30 text-positive shadow-float'
                  : hovered || grabbed
                    ? 'border-accent bg-accent/30 text-accent shadow-float'
                    : 'border-accent/40 bg-accent/10 text-accent')
              }
            >
              <ListTodo size={18} />
            </div>
            <span className="truncate text-center text-[11px] text-muted">{task.title}</span>
          </div>
        )
      })}
      {pending.length === 0 && (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-faint">
          Bekleyen görev yok
        </p>
      )}
    </div>
  )
}
