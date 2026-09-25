import { useEffect, useMemo, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { MemoryWithEmbedding, NoteWithEmbedding, SettingsView } from '@shared/api'
import { buildEdges, layoutGraph, type GraphNode } from '../../lib/graphLayout'
import { useLiveData } from '../../lib/useLiveData'
import { secondaryButtonClass, inputClass } from '../../lib/styles'
import { errorMessage } from '../../lib/errors'
import { useToast } from '../../lib/toast'
import Modal from '../ui/Modal'

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
  title: string
  embedding: Float32Array | null
}

function toGraphNode(item: MapItem): GraphNode {
  return { id: item.id, embedding: item.embedding }
}

function firstWords(text: string, max = 40): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

interface MemoryGraphProps {
  /** ChatPage/CalendarPage'deki ile aynı desen: App.tsx sayfayı 'settings' yapar */
  onOpenSettings: () => void
}

function MemoryGraph({ onOpenSettings }: MemoryGraphProps): React.JSX.Element {
  const settings = useLiveData(loadSettings, 'settings')
  const notes = useLiveData(loadNotes, 'notes')
  const memories = useLiveData(loadMemories, 'memories')

  const semanticSearchEnabled = settings.data?.semanticSearchEnabled ?? false

  const items: MapItem[] = useMemo(() => {
    const noteItems: MapItem[] =
      notes.data?.map((n) => ({
        id: `note-${n.id}`,
        kind: 'note' as const,
        refId: n.id,
        title: n.title || firstWords(n.content) || 'Başlıksız not',
        embedding: n.embedding ? Float32Array.from(n.embedding) : null
      })) ?? []
    const memoryItems: MapItem[] =
      memories.data?.map((m) => ({
        id: `memory-${m.id}`,
        kind: 'memory' as const,
        refId: m.id,
        title: firstWords(m.content),
        embedding: m.embedding ? Float32Array.from(m.embedding) : null
      })) ?? []
    return [...noteItems, ...memoryItems]
  }, [notes.data, memories.data])

  const hasAnyEmbedding = items.some((item) => item.embedding !== null)

  if (!semanticSearchEnabled || !hasAnyEmbedding) {
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

  const graphNodes = items.map(toGraphNode)
  const edges = buildEdges(graphNodes)
  const positions = layoutGraph(graphNodes, edges)

  return <MemoryGraphScene items={items} edges={edges} positions={positions} />
}

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

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    )
    camera.position.set(0, 0, 12)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    const nodeMeshes = new Map<string, THREE.Mesh>()
    const sphereGeometry = new THREE.SphereGeometry(0.18, 16, 16)
    for (const item of items) {
      const p = positions.get(item.id)
      if (!p) continue
      const material = new THREE.MeshBasicMaterial({
        color: item.kind === 'note' ? NOTE_COLOR : MEMORY_COLOR
      })
      const mesh = new THREE.Mesh(sphereGeometry, material)
      mesh.position.set(p.x, p.y, p.z)
      mesh.userData.itemId = item.id
      scene.add(mesh)
      nodeMeshes.set(item.id, mesh)
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

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()

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
      const item = id ? items.find((i) => i.id === id) : null
      setHoverTitle(item?.title ?? null)
      container!.style.cursor = item ? 'pointer' : 'grab'
    }

    function onClick(e: MouseEvent): void {
      const id = pickItemId(e.clientX, e.clientY)
      const item = id ? items.find((i) => i.id === id) : null
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

    function onResize(): void {
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('click', onClick)
      controls.dispose()
      renderer.dispose()
      sphereGeometry.dispose()
      for (const mesh of nodeMeshes.values()) {
        ;(mesh.material as THREE.Material).dispose()
      }
      for (const geometry of edgeGeometries) geometry.dispose()
      for (const material of edgeMaterials) material.dispose()
      container.removeChild(renderer.domElement)
    }
    // items/edges/positions bir üst bileşende veri değişince yeniden hesaplanıyor (useMemo yok
    // burada çünkü zaten MemoryGraph'ta hesaplanmış olarak geliyor); referansları değişince sahne
    // baştan kurulsun istiyoruz.
  }, [items, edges, positions])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {hoverTitle && (
        <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-elevated px-3 py-1.5 text-sm text-ink shadow-float">
          {hoverTitle}
        </div>
      )}
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
  const [text, setText] = useState(item.title)
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
    <Modal open onClose={onClose}>
      <h2 className="mb-3 text-sm font-medium text-muted">
        {item.kind === 'note' ? 'Not' : 'Hafıza kaydı'}
      </h2>
      <textarea
        className={`${inputClass} min-h-24 resize-none`}
        value={text}
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
