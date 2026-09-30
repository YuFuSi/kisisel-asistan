import { useEffect, useMemo, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { MemoryWithEmbedding, NoteWithEmbedding, SettingsView } from '@shared/api'
import {
  buildEdges,
  layoutGraph,
  type GraphEdge,
  type GraphNode,
  type Vec3
} from '../../lib/graphLayout'
import { useLiveData } from '../../lib/useLiveData'
import { secondaryButtonClass, inputClass } from '../../lib/styles'
import { errorMessage } from '../../lib/errors'
import { useToast } from '../../lib/toast'
import Modal from '../ui/Modal'
import Skeleton from '../ui/Skeleton'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadSettings = (): Promise<SettingsView> => window.api.settings.get()
const loadNotes = (): Promise<NoteWithEmbedding[]> => window.api.notes.listWithEmbeddings()
const loadMemories = (): Promise<MemoryWithEmbedding[]> => window.api.memories.listWithEmbeddings()

const NOTE_COLOR = 0x8b9bff // accent
const MEMORY_COLOR = 0x6fd6c9 // ikincil ton, tasarımdaki glow ailesinden

interface MapItem {
  id: string
  kind: 'note' | 'memory'
  refId: number
  /** Yörünge/etiket/tooltip için kısaltılmış görüntüleme metni. */
  title: string
  /** Düzenleme kipinin başlangıç değeri: notta gerçek başlık (boş olabilir), hafızada tam içerik.
   *  Görüntüleme için kısaltılmış `title`'dan asla üretilmez. */
  raw: string
  embedding: Float32Array | null
}

function toGraphNode(item: MapItem): GraphNode {
  return { id: item.id, embedding: item.embedding }
}

function firstWords(text: string, max = 40): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

/** İki düğüm kümesinin gerçekten aynı grafiği (kimlikler + embedding değerleri) üretip
 *  üretmediğini ucuzca ayırt etmek için imza. Sadece başlık/içerik değişirse (embedding aynı
 *  kalırsa) imza değişmez — bu, düzenleme sonrası yeniden yerleşimi (relayout) önlemek için kasıtlı. */
function embeddingSignature(items: MapItem[]): string {
  return items
    .map((item) => `${item.id}:${item.embedding ? hashFloats(item.embedding) : 'yok'}`)
    .join('|')
}

function hashFloats(values: Float32Array): string {
  let hash = 0
  for (let i = 0; i < values.length; i++) {
    hash = (hash * 31 + Math.round(values[i] * 1000)) | 0
  }
  return hash.toString(36)
}

interface MemoryGraphProps {
  /** ChatPage/CalendarPage'deki ile aynı desen: App.tsx sayfayı 'settings' yapar */
  onOpenSettings: () => void
}

function MemoryGraph({ onOpenSettings }: MemoryGraphProps): React.JSX.Element {
  const settings = useLiveData(loadSettings, 'settings')
  const notes = useLiveData(loadNotes, 'notes')
  const memories = useLiveData(loadMemories, 'memories')
  const toast = useToast()
  const [indexing, setIndexing] = useState(false)

  const semanticSearchEnabled = settings.data?.semanticSearchEnabled ?? false

  const items: MapItem[] = useMemo(() => {
    const noteItems: MapItem[] =
      notes.data?.map((n) => ({
        id: `note-${n.id}`,
        kind: 'note' as const,
        refId: n.id,
        title: n.title || firstWords(n.content) || 'Başlıksız not',
        raw: n.title,
        embedding: n.embedding ? Float32Array.from(n.embedding) : null
      })) ?? []
    const memoryItems: MapItem[] =
      memories.data?.map((m) => ({
        id: `memory-${m.id}`,
        kind: 'memory' as const,
        refId: m.id,
        title: firstWords(m.content),
        raw: m.content,
        embedding: m.embedding ? Float32Array.from(m.embedding) : null
      })) ?? []
    return [...noteItems, ...memoryItems]
  }, [notes.data, memories.data])

  // Yerleşim (layout) rastgele başlangıçlı olduğu için her render'da yeniden hesaplanırsa harita
  // sürekli karışır (bkz. graphLayout.ts). İmza sadece kimlik + embedding değiştiğinde değişir;
  // başlık/içerik düzenlenip kayıt yeniden çekildiğinde (useLiveData) imza aynı kalır ve
  // aşağıdaki useMemo eski `edges`/`positions` referansını korur.
  const graphKey = useMemo(() => embeddingSignature(items), [items])
  const { edges, positions } = useMemo<{
    edges: GraphEdge[]
    positions: Map<string, Vec3>
  }>(() => {
    const graphNodes = items.map(toGraphNode)
    const builtEdges = buildEdges(graphNodes)
    const builtPositions = layoutGraph(graphNodes, builtEdges)
    return { edges: builtEdges, positions: builtPositions }
    // items kasıtlı olarak dependency listesinde değil: sadece graphKey (kimlik + embedding)
    // değiştiğinde yeniden hesaplanmalı, her `items` referansı değişiminde değil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphKey])

  const loading = settings.data === null || notes.data === null || memories.data === null
  const hasAnyEmbedding = items.some((item) => item.embedding !== null)

  async function backfillEmbeddings(): Promise<void> {
    setIndexing(true)
    try {
      const [noteCount, memoryCount] = await Promise.all([
        window.api.notes.backfillEmbeddings(),
        window.api.memories.backfillEmbeddings()
      ])
      const total = noteCount + memoryCount
      toast.success(
        total === 0 ? 'Zaten güncel, indekslenecek kayıt yok.' : `${total} kayıt indekslendi.`
      )
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setIndexing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Skeleton className="h-40 w-40 rounded-full" />
      </div>
    )
  }

  if (!semanticSearchEnabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Info className="text-faint" size={28} />
        <p className="max-w-sm text-sm text-muted">
          Haritayı görmek için önce Ayarlar &gt; Asistan&apos;dan &quot;Anlamsal arama&quot;yı aç.
        </p>
        <button className={secondaryButtonClass} onClick={onOpenSettings}>
          Ayarlara git
        </button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-faint">Henüz kayıt yok</p>
      </div>
    )
  }

  if (!hasAnyEmbedding) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Info className="text-faint" size={28} />
        <p className="max-w-sm text-sm text-muted">
          Haritayı görmek için notların ve hafıza kayıtlarının indekslenmesi gerekiyor.
        </p>
        <button
          className={secondaryButtonClass}
          disabled={indexing}
          onClick={() => void backfillEmbeddings()}
        >
          {indexing ? 'İndeksleniyor...' : 'İndeksle'}
        </button>
      </div>
    )
  }

  return <MemoryGraphScene items={items} edges={edges} positions={positions} />
}

// Düğüm kürelerine hafif bir ışıma (glow) katmanı — biraz daha büyük, saydam, additive
// karışımlı ikinci bir küre. Raycaster hedeflerine eklenmez (sadece asıl küre tıklanabilir).
const NODE_RADIUS = 0.18
const GLOW_RADIUS = 0.34
const HOVER_SCALE = 1.35

function MemoryGraphScene({
  items,
  edges,
  positions
}: {
  items: MapItem[]
  edges: ReturnType<typeof buildEdges>
  positions: Map<string, { x: number; y: number; z: number }>
}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverTitle, setHoverTitle] = useState<string | null>(null)
  const [editing, setEditing] = useState<MapItem | null>(null)
  // Tooltip/tıklama işleyicileri sahneyi yeniden kurmadan güncel `items`i görsün diye — sahne
  // sadece konum/kenar değişince (graphKey), başlık gibi metin değişimlerinde yeniden kurulmasın.
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const noteCount = items.filter((i) => i.kind === 'note').length
  const memoryCount = items.length - noteCount

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    )

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 1
    controls.maxDistance = 120

    const nodeMeshes = new Map<string, THREE.Mesh>()
    const glowMeshes = new Map<string, THREE.Mesh>()
    const sphereGeometry = new THREE.SphereGeometry(NODE_RADIUS, 16, 16)
    const glowGeometry = new THREE.SphereGeometry(GLOW_RADIUS, 16, 16)
    for (const item of items) {
      const p = positions.get(item.id)
      if (!p) continue
      const color = item.kind === 'note' ? NOTE_COLOR : MEMORY_COLOR
      const material = new THREE.MeshBasicMaterial({ color })
      const mesh = new THREE.Mesh(sphereGeometry, material)
      mesh.position.set(p.x, p.y, p.z)
      mesh.userData.itemId = item.id
      scene.add(mesh)
      nodeMeshes.set(item.id, mesh)

      const glowMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
      const glow = new THREE.Mesh(glowGeometry, glowMaterial)
      glow.position.copy(mesh.position)
      scene.add(glow)
      glowMeshes.set(item.id, glow)
    }

    const edgeGeometries: THREE.BufferGeometry[] = []
    const edgeMaterials: THREE.Material[] = []
    for (const edge of edges) {
      const a = positions.get(edge.source)
      const b = positions.get(edge.target)
      if (!a || !b) continue
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a.x, a.y, a.z),
        new THREE.Vector3(b.x, b.y, b.z)
      ])
      const material = new THREE.LineBasicMaterial({
        color: 0x8b9bff,
        transparent: true,
        opacity: 0.15 + edge.strength * 0.35
      })
      edgeGeometries.push(geometry)
      edgeMaterials.push(material)
      scene.add(new THREE.Line(geometry, material))
    }

    // Kamerayı, tüm düğümleri kapsayan sınır kutusuna göre otomatik sığdır — kullanıcı elle
    // uzaklaşmak zorunda kalmasın (bkz. canlı testte bulunan "düğümler kadraj dışı" sorunu).
    const box = new THREE.Box3()
    for (const p of positions.values()) box.expandByPoint(new THREE.Vector3(p.x, p.y, p.z))
    const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3())
    const size = box.isEmpty() ? new THREE.Vector3(1, 1, 1) : box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z, 2)
    const fitDistance =
      (maxDim / 2 / Math.tan((Math.PI * camera.fov) / 360)) * 1.5 /* kenar boşluğu payı */
    camera.position.set(center.x, center.y, center.z + fitDistance)
    controls.target.copy(center)
    camera.lookAt(center)
    controls.update()

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let hoveredId: string | null = null

    function setHovered(id: string | null): void {
      if (hoveredId === id) return
      if (hoveredId) glowMeshes.get(hoveredId)?.scale.setScalar(1)
      hoveredId = id
      if (hoveredId) glowMeshes.get(hoveredId)?.scale.setScalar(HOVER_SCALE)
    }

    function pickItemId(clientX: number, clientY: number): string | null {
      const rect = container!.getBoundingClientRect()
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects([...nodeMeshes.values()])[0]
      return (hit?.object.userData.itemId as string | undefined) ?? null
    }

    function onPointerMove(e: PointerEvent): void {
      const id = pickItemId(e.clientX, e.clientY)
      const item = id ? itemsRef.current.find((i) => i.id === id) : null
      setHovered(item ? id : null)
      setHoverTitle(item?.title ?? null)
      container!.style.cursor = item ? 'pointer' : 'grab'
    }

    function onClick(e: MouseEvent): void {
      const id = pickItemId(e.clientX, e.clientY)
      const item = id ? itemsRef.current.find((i) => i.id === id) : null
      if (item) setEditing(item)
    }

    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('click', onClick)

    let rafId = 0
    function animate(): void {
      controls.update()
      renderer.render(scene, camera)
      rafId = requestAnimationFrame(animate)
    }
    animate()

    const resizeObserver = new ResizeObserver(() => {
      if (!container.clientWidth || !container.clientHeight) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    })
    resizeObserver.observe(container)

    return () => {
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('click', onClick)
      controls.dispose()
      renderer.dispose()
      sphereGeometry.dispose()
      glowGeometry.dispose()
      for (const mesh of nodeMeshes.values()) {
        ;(mesh.material as THREE.Material).dispose()
      }
      for (const glow of glowMeshes.values()) {
        ;(glow.material as THREE.Material).dispose()
      }
      for (const geometry of edgeGeometries) geometry.dispose()
      for (const material of edgeMaterials) material.dispose()
      container.removeChild(renderer.domElement)
    }
    // `items` kasıtlı olarak dependency listesinde değil: küre/renk/ilk konum kurulumu sadece
    // ilk kurulumda `items`in o anki değerini kullanır, sonrasında hover/tıklama itemsRef'ten
    // okur — sadece konum/kenar (graphKey) değişince sahne baştan kurulsun, başlık gibi metin
    // düzenlemelerinde kamera/sahne korunsun.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, positions])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {hoverTitle && (
        <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-elevated px-3 py-1.5 text-sm text-ink shadow-float">
          {hoverTitle}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-3 rounded-md bg-elevated/80 px-3 py-1.5 text-xs text-muted shadow-float">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: `#${NOTE_COLOR.toString(16)}` }}
          />
          {noteCount} not
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: `#${MEMORY_COLOR.toString(16)}` }}
          />
          {memoryCount} hafıza
        </span>
      </div>
      {editing && <MemoryGraphEditModal item={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function MemoryGraphEditModal({
  item,
  onClose
}: {
  item: MapItem
  onClose: () => void
}): React.JSX.Element {
  const toast = useToast()
  const [text, setText] = useState(item.raw)
  const [saving, setSaving] = useState(false)

  async function save(): Promise<void> {
    setSaving(true)
    try {
      if (item.kind === 'note') {
        await window.api.notes.update(item.refId, { title: text })
      } else {
        await window.api.memories.update(item.refId, text)
      }
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={item.kind === 'note' ? 'Not başlığı' : 'Hafıza kaydı'}>
      <h2 className="mb-3 text-sm font-medium text-muted">
        {item.kind === 'note' ? 'Not başlığı' : 'Hafıza kaydı'}
      </h2>
      <textarea
        className={`${inputClass} min-h-24 resize-none`}
        value={text}
        placeholder={item.kind === 'note' ? 'Başlıksız (boş bırakılabilir)' : undefined}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex justify-end gap-2">
        <button className={secondaryButtonClass} onClick={onClose}>
          Vazgeç
        </button>
        <button className={secondaryButtonClass} disabled={saving} onClick={() => void save()}>
          Kaydet
        </button>
      </div>
    </Modal>
  )
}

export default MemoryGraph
