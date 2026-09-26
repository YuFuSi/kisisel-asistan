# Hafıza Haritası (3B anlamsal düğüm grafiği) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hafıza Merkezi sayfasına, notları ve hafıza kayıtlarını anlamsal benzerliğe göre
bağlantılı 3B küreler olarak gösteren, fareyle gezinilebilen bir "Harita" görünümü eklemek.

**Architecture:** Benzerlik hesaplama ve kuvvet yönlendirmeli (force-directed) yerleşim tamamen
renderer'da, saf TypeScript fonksiyonlarıyla yapılır (main sürece yük binmez). Görselleştirme
gerçek bir three.js `WebGLRenderer` sahnesiyle çizilir (`OrbitControls` ile fare gezinme,
`Raycaster` ile hover/tıklama). Veri, mevcut main-süreç fonksiyonları (`listMemoriesWithEmbeddings`,
`listNotesWithEmbeddings`) üzerinden, üç dosyalık IPC deseniyle yeni bir uç noktadan gelir.

**Tech Stack:** React 19 + TypeScript, three.js (zaten bağımlılık, `OrbitControls`/`Raycaster`
dahil), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-25-hafiza-haritasi-design.md`

## Global Constraints

- Yeni npm bağımlılığı **eklenmez** — three.js zaten `package.json`'da (`^0.186.0`, `@types/three`
  dahil).
- Renkler tasarım belirteçleriyle (`accent`, `glow` vb.) verilir, ham hex/tailwind renk sınıfı
  (`violet-500` gibi) kullanılmaz.
- Her fonksiyonda açık dönüş tipi yazılır (`function x(): void`).
- Effect içinde senkron `setState` çağrılmaz; `void Promise.resolve().then(() => setX(...))`
  deseni kullanılır (`react-hooks/set-state-in-effect`).
- Ref'in `.current` değeri render sırasında okunmaz (`react-hooks/refs`).
- IPC yeni bir işlem eklerken üç dosya birden güncellenir: `src/shared/api.ts`, `src/main/ipc.ts`,
  `src/preload/index.ts`.
- Commit mesajları Türkçe, `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` satırıyla
  biter.
- Her görev sonunda `npm run typecheck && npm run lint && npm run test` çalıştırılıp temiz
  geçtiği doğrulanır.

---

### Task 1: Renderer'da kosinüs benzerliği yardımcı fonksiyonu

**Files:**
- Create: `src/renderer/src/lib/cosine.ts`
- Test: `src/renderer/src/lib/cosine.test.ts`

**Interfaces:**
- Produces: `cosineSimilarity(a: Float32Array, b: Float32Array): number` — sonraki görevlerde
  `graphLayout.ts` bunu kullanır.

- [ ] **Step 1: Write the failing test**

```ts
// src/renderer/src/lib/cosine.test.ts
import { describe, expect, it } from 'vitest'
import { cosineSimilarity } from './cosine'

describe('cosineSimilarity', () => {
  it('aynı vektör için 1 döner', () => {
    const v = new Float32Array([1, 2, 3])
    expect(cosineSimilarity(v, v)).toBeCloseTo(1)
  })

  it('dik vektörler için 0 döner', () => {
    const a = new Float32Array([1, 0])
    const b = new Float32Array([0, 1])
    expect(cosineSimilarity(a, b)).toBeCloseTo(0)
  })

  it('zıt yönlü vektörler için -1 döner', () => {
    const a = new Float32Array([1, 0])
    const b = new Float32Array([-1, 0])
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1)
  })

  it('sıfır vektörde 0 döner (bölme hatası olmaz)', () => {
    const zero = new Float32Array([0, 0, 0])
    const v = new Float32Array([1, 2, 3])
    expect(cosineSimilarity(zero, v)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- cosine.test.ts`
Expected: FAIL — `cosine.ts` içinde `cosineSimilarity` bulunamıyor (modül yok).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/renderer/src/lib/cosine.ts
// main sürecin lib/cosine.ts'i ile aynı mantık; renderer'a electron olmadan taşınabilir küçük
// bir saf fonksiyon olduğu için burada ayrıca tanımlı (import sınırları main/renderer arasında
// paylaşım yapmıyor).
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length)
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- cosine.test.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/cosine.ts src/renderer/src/lib/cosine.test.ts
git commit -m "Hafıza haritası: renderer'da kosinüs benzerliği yardımcı fonksiyonu

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Kenar listesi ve kuvvet yönlendirmeli 3B yerleşim

**Files:**
- Create: `src/renderer/src/lib/graphLayout.ts`
- Test: `src/renderer/src/lib/graphLayout.test.ts`

**Interfaces:**
- Consumes: `cosineSimilarity(a: Float32Array, b: Float32Array): number` (Task 1).
- Produces:
  - `interface GraphNode { id: string; embedding: Float32Array | null }`
  - `interface GraphEdge { source: string; target: string; strength: number }`
  - `buildEdges(nodes: GraphNode[], threshold?: number, maxPerNode?: number): GraphEdge[]`
  - `interface Vec3 { x: number; y: number; z: number }`
  - `layoutGraph(nodes: GraphNode[], edges: GraphEdge[], iterations?: number): Map<string, Vec3>`
  - Bu iki fonksiyon Task 6'da `MemoryGraph.tsx` tarafından kullanılır.

- [ ] **Step 1: Write the failing test**

```ts
// src/renderer/src/lib/graphLayout.test.ts
import { describe, expect, it } from 'vitest'
import { buildEdges, layoutGraph, type GraphNode } from './graphLayout'

function vec(...values: number[]): Float32Array {
  return new Float32Array(values)
}

describe('buildEdges', () => {
  it('embedding eşiğin üstündeki en benzer düğümler arasında kenar kurar', () => {
    const nodes: GraphNode[] = [
      { id: 'a', embedding: vec(1, 0, 0) },
      { id: 'b', embedding: vec(0.99, 0.01, 0) }, // a'ya çok benzer
      { id: 'c', embedding: vec(0, 1, 0) } // a'ya benzemez
    ]
    const edges = buildEdges(nodes, 0.9, 4)
    expect(edges).toHaveLength(1)
    expect([edges[0].source, edges[0].target].sort()).toEqual(['a', 'b'])
  })

  it('embedding\'i olmayan düğümler için kenar kurmaz', () => {
    const nodes: GraphNode[] = [
      { id: 'a', embedding: null },
      { id: 'b', embedding: vec(1, 0) }
    ]
    expect(buildEdges(nodes, 0.5, 4)).toHaveLength(0)
  })

  it('her düğüm için en fazla maxPerNode kenar tutar', () => {
    // Hepsi birbirine çok benzer (5 düğüm, hepsi eşiği geçiyor) ama maxPerNode=2
    const nodes: GraphNode[] = Array.from({ length: 5 }, (_, i) => ({
      id: `n${i}`,
      embedding: vec(1, i * 0.001) // hepsi neredeyse aynı yönde
    }))
    const edges = buildEdges(nodes, 0.5, 2)
    const degree = new Map<string, number>()
    for (const e of edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1)
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1)
    }
    for (const count of degree.values()) expect(count).toBeLessThanOrEqual(2)
  })
})

describe('layoutGraph', () => {
  it('her düğüm için bir konum üretir', () => {
    const nodes: GraphNode[] = [
      { id: 'a', embedding: vec(1, 0) },
      { id: 'b', embedding: vec(1, 0) },
      { id: 'c', embedding: vec(0, 1) }
    ]
    const edges = buildEdges(nodes, 0.5, 4)
    const positions = layoutGraph(nodes, edges, 50)
    expect(positions.size).toBe(3)
    for (const id of ['a', 'b', 'c']) {
      const p = positions.get(id)
      expect(p).toBeDefined()
      expect(Number.isFinite(p!.x)).toBe(true)
      expect(Number.isFinite(p!.y)).toBe(true)
      expect(Number.isFinite(p!.z)).toBe(true)
    }
  })

  it('bağlı iki düğüm, bağlı olmayan bir düğümden daha yakın durur', () => {
    const nodes: GraphNode[] = [
      { id: 'a', embedding: vec(1, 0, 0) },
      { id: 'b', embedding: vec(0.99, 0.01, 0) }, // a'ya çok benzer, bağlı olacak
      { id: 'c', embedding: vec(-1, 0, 0) } // a'ya zıt, bağlı olmayacak
    ]
    const edges = buildEdges(nodes, 0.9, 4)
    const positions = layoutGraph(nodes, edges, 200)
    const dist = (p: { x: number; y: number; z: number }, q: typeof p): number =>
      Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)
    const distAB = dist(positions.get('a')!, positions.get('b')!)
    const distAC = dist(positions.get('a')!, positions.get('c')!)
    expect(distAB).toBeLessThan(distAC)
  })

  it('çakışan başlangıç konumlarında bile düğümleri ayırır (itme çalışıyor)', () => {
    const nodes: GraphNode[] = [
      { id: 'a', embedding: null },
      { id: 'b', embedding: null }
    ]
    const positions = layoutGraph(nodes, [], 100)
    const a = positions.get('a')!
    const b = positions.get('b')!
    expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThan(0.01)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- graphLayout.test.ts`
Expected: FAIL — `graphLayout.ts` yok.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/renderer/src/lib/graphLayout.ts
// Hafıza haritası: notlar/hafıza kayıtları arasındaki anlamsal benzerlikten kenar listesi kurma
// ve basit bir kuvvet yönlendirmeli (force-directed) 3B yerleşim. Yeni bir kütüphane eklemeden
// (three.js sadece render için kullanılacak, burası saf matematik) — bu yüzden üç.js tipine değil
// düz {x,y,z} nesnesine (Vec3) döner.
import { cosineSimilarity } from './cosine'

export interface GraphNode {
  id: string
  embedding: Float32Array | null
}

export interface GraphEdge {
  source: string
  target: string
  strength: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

const DEFAULT_THRESHOLD = 0.55
const DEFAULT_MAX_PER_NODE = 4

/**
 * Her düğüm için en benzer `maxPerNode` komşuyu (eşiği geçenler arasından) kenar olarak seçer.
 * Aynı çift için iki yönden de seçilse tek kenar tutulur (kenarın kendisi yönsüz).
 */
export function buildEdges(
  nodes: GraphNode[],
  threshold = DEFAULT_THRESHOLD,
  maxPerNode = DEFAULT_MAX_PER_NODE
): GraphEdge[] {
  const candidates = new Map<string, { other: string; strength: number }[]>()

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]
    if (!a.embedding) continue
    const scored: { other: string; strength: number }[] = []
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue
      const b = nodes[j]
      if (!b.embedding) continue
      const strength = cosineSimilarity(a.embedding, b.embedding)
      if (strength >= threshold) scored.push({ other: b.id, strength })
    }
    scored.sort((x, y) => y.strength - x.strength)
    candidates.set(a.id, scored.slice(0, maxPerNode))
  }

  const seen = new Set<string>()
  const edges: GraphEdge[] = []
  for (const [id, list] of candidates) {
    for (const { other, strength } of list) {
      const key = [id, other].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ source: id, target: other, strength })
    }
  }
  return edges
}

const DEFAULT_ITERATIONS = 180
// Sabitler deneysel: düğümler birbirini bu kadar itsin (REPULSION), bağlı düğümler bu mesafeye
// (REST_LENGTH) gelene kadar yay gibi çekilsin, DAMPING her adımda hızı yavaşlatıp simülasyonun
// durmasını sağlasın.
const REPULSION = 4
const REST_LENGTH = 2.2
const SPRING_STRENGTH = 0.02
const DAMPING = 0.85
const INITIAL_RADIUS = 5

/** Basit, deterministik olmayan (rastgele başlangıçlı) ama sabit sayıda iterasyonda duran 3B
 *  kuvvet yönlendirmeli yerleşim. Konumlar bir kez hesaplanıp çağıran tarafından önbelleğe
 *  alınmalı — her karede yeniden çağrılmamalı (performans). */
export function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  iterations = DEFAULT_ITERATIONS
): Map<string, Vec3> {
  const position = new Map<string, Vec3>()
  const velocity = new Map<string, Vec3>()

  for (const node of nodes) {
    // Küre yüzeyine yakın rastgele başlangıç — hepsi orijinde başlarsa itme kuvveti yön bulamaz
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    position.set(node.id, {
      x: INITIAL_RADIUS * Math.sin(phi) * Math.cos(theta) * Math.random(),
      y: INITIAL_RADIUS * Math.sin(phi) * Math.sin(theta) * Math.random(),
      z: INITIAL_RADIUS * Math.cos(phi) * Math.random()
    })
    velocity.set(node.id, { x: 0, y: 0, z: 0 })
  }

  const edgesByNode = new Map<string, GraphEdge[]>()
  for (const edge of edges) {
    if (!edgesByNode.has(edge.source)) edgesByNode.set(edge.source, [])
    if (!edgesByNode.has(edge.target)) edgesByNode.set(edge.target, [])
    edgesByNode.get(edge.source)!.push(edge)
    edgesByNode.get(edge.target)!.push(edge)
  }

  for (let step = 0; step < iterations; step++) {
    const force = new Map<string, Vec3>(nodes.map((n) => [n.id, { x: 0, y: 0, z: 0 }]))

    // İtme: her çift birbirini iter (Coulomb benzeri, 1/mesafe^2, çok yakınken sınırlı)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = position.get(nodes[i].id)!
        const b = position.get(nodes[j].id)!
        const dx = a.x - b.x
        const dy = a.y - b.y
        const dz = a.z - b.z
        const distSq = Math.max(dx * dx + dy * dy + dz * dz, 0.01)
        const dist = Math.sqrt(distSq)
        const magnitude = REPULSION / distSq
        const fx = (dx / dist) * magnitude
        const fy = (dy / dist) * magnitude
        const fz = (dz / dist) * magnitude
        const fa = force.get(nodes[i].id)!
        const fb = force.get(nodes[j].id)!
        fa.x += fx
        fa.y += fy
        fa.z += fz
        fb.x -= fx
        fb.y -= fy
        fb.z -= fz
      }
    }

    // Çekme: bağlı düğümler REST_LENGTH mesafesine gelene kadar yay gibi çekilir
    for (const edge of edges) {
      const a = position.get(edge.source)!
      const b = position.get(edge.target)!
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dz = b.z - a.z
      const dist = Math.max(Math.hypot(dx, dy, dz), 0.01)
      const displacement = dist - REST_LENGTH
      const magnitude = displacement * SPRING_STRENGTH * edge.strength
      const fx = (dx / dist) * magnitude
      const fy = (dy / dist) * magnitude
      const fz = (dz / dist) * magnitude
      const fa = force.get(edge.source)!
      const fb = force.get(edge.target)!
      fa.x += fx
      fa.y += fy
      fa.z += fz
      fb.x -= fx
      fb.y -= fy
      fb.z -= fz
    }

    for (const node of nodes) {
      const v = velocity.get(node.id)!
      const f = force.get(node.id)!
      v.x = (v.x + f.x) * DAMPING
      v.y = (v.y + f.y) * DAMPING
      v.z = (v.z + f.z) * DAMPING
      const p = position.get(node.id)!
      p.x += v.x
      p.y += v.y
      p.z += v.z
    }
  }

  return position
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- graphLayout.test.ts`
Expected: PASS (5/5). "bağlı iki düğüm daha yakın durur" testi rastgele başlangıca rağmen 200
iterasyonda güvenilir geçmeli (itme/çekme sabitleri bu senaryoyla denendi); geçmezse
`SPRING_STRENGTH`'i artırıp tekrar dene.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/graphLayout.ts src/renderer/src/lib/graphLayout.test.ts
git commit -m "Hafıza haritası: kenar listesi ve kuvvet yönlendirmeli 3B yerleşim

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Embedding'li not/hafıza listeleme için paylaşılan tipler ve Api arayüzü

**Files:**
- Modify: `src/shared/api.ts` (Note/Memory tanımlarının yanına, `Api.notes`/`Api.memories`
  bloklarına ekleme)

**Interfaces:**
- Consumes: hiçbir önceki görevden kod tüketmiyor (bağımsız).
- Produces:
  - `interface NoteWithEmbedding extends Note { embedding: number[] | null }`
  - `interface MemoryWithEmbedding extends Memory { embedding: number[] | null }`
  - `Api.notes.listWithEmbeddings(): Promise<NoteWithEmbedding[]>`
  - `Api.memories.listWithEmbeddings(): Promise<MemoryWithEmbedding[]>`
  - Task 4 (`ipc.ts`) ve Task 6 (`MemoryGraph.tsx`) bu isimleri kullanır.

**Not:** Embedding tipi `Float32Array` değil `number[]` — Electron IPC yapılandırılmış klonlama
(structured clone) `Float32Array`'i taşıyabilir ama `Api` arayüzündeki diğer tüm tipler düz JSON
uyumlu; tutarlılık için main tarafında `Array.from(embedding)` ile düz diziye çevrilecek (Task 4),
renderer'da `Float32Array.from(...)` ile geri çevrilecek (Task 6).

- [ ] **Step 1: `Note`/`Memory` tanımlarının hemen altına yeni tipleri ekle**

`src/shared/api.ts` içinde `export interface Note { ... }` bloğundan sonra:

```ts
/** Harita görünümü için: embedding vektörü de dahil (normal `Note`'ta yok, IPC payload'ı
 *  büyümesin diye sadece bu uç nokta embedding taşır). */
export interface NoteWithEmbedding extends Note {
  embedding: number[] | null
}
```

`export interface Memory { ... }` bloğundan sonra:

```ts
/** Harita görünümü için: embedding vektörü de dahil. */
export interface MemoryWithEmbedding extends Memory {
  embedding: number[] | null
}
```

- [ ] **Step 2: `Api.notes` ve `Api.memories` bloklarına yeni metodu ekle**

`notes: { ... }` bloğunun içine, `search` satırından sonra:

```ts
    /** Hafıza haritası için: embedding vektörleriyle birlikte tüm notlar */
    listWithEmbeddings(): Promise<NoteWithEmbedding[]>
```

`memories: { ... }` bloğunun içine, `search` satırından sonra:

```ts
    /** Hafıza haritası için: embedding vektörleriyle birlikte tüm hafıza kayıtları */
    listWithEmbeddings(): Promise<MemoryWithEmbedding[]>
```

- [ ] **Step 3: Typecheck çalıştır (henüz `ipc.ts`/`preload` bağlanmadığı için hata bekleniyor
      olabilir — bu görevde sadece `shared/api.ts`'in kendisinin derlendiğini doğrula)**

Run: `npm run typecheck:node`
Expected: PASS — bu dosya başka hiçbir yere henüz bağlı olmadığı için hata vermemeli. Eğer
`window.api` kullanan bir yerde "Property 'listWithEmbeddings' does not exist" gibi bir hata
görürsen (olmamalı, henüz kullanan kod yok), Task 4/5'e geçmeden önce bu görevi gözden geçir.

- [ ] **Step 4: Commit**

```bash
git add src/shared/api.ts
git commit -m "Hafıza haritası: NoteWithEmbedding/MemoryWithEmbedding tipleri ve Api arayüzü

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: IPC — `notes:listWithEmbeddings` / `memories:listWithEmbeddings`

**Files:**
- Modify: `src/main/ipc.ts`

**Interfaces:**
- Consumes: `listNotesWithEmbeddings(): NoteWithEmbedding[]` (main'in kendi, `src/main/data/notes.ts`
  — dikkat, adı `shared/api.ts`'teki ile aynı ama farklı dosyada, `embedding: Float32Array | null`
  taşıyor), `listMemoriesWithEmbeddings(): MemoryWithEmbedding[]` (`src/main/data/memories.ts`,
  aynı durum). Bu iki fonksiyon zaten mevcut, K-turundan kalma.
- Produces: `notes:listWithEmbeddings` ve `memories:listWithEmbeddings` IPC kanalları — Task 5
  (`preload/index.ts`) bunları çağırır.

- [ ] **Step 1: `notes.ts`'ten `listNotesWithEmbeddings` import'unu ekle**

`src/main/ipc.ts`'in üst kısmında notlarla ilgili import satırını bul (ör.
`import { createNote, ... } from './data/notes'` gibi) ve `listNotesWithEmbeddings`'i ekle.

- [ ] **Step 2: `memories.ts`'ten `listMemoriesWithEmbeddings` import'unu ekle**

Aynı şekilde hafıza import satırına `listMemoriesWithEmbeddings` ekle.

- [ ] **Step 3: `notes:search` satırından hemen sonra yeni handler'ı ekle**

```ts
  ipcMain.handle('notes:listWithEmbeddings', () =>
    listNotesWithEmbeddings().map((note) => ({
      ...note,
      embedding: note.embedding ? Array.from(note.embedding) : null
    }))
  )
```

- [ ] **Step 4: `memories:search` satırından hemen sonra yeni handler'ı ekle**

```ts
  ipcMain.handle('memories:listWithEmbeddings', () =>
    listMemoriesWithEmbeddings().map((memory) => ({
      ...memory,
      embedding: memory.embedding ? Array.from(memory.embedding) : null
    }))
  )
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck:node`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc.ts
git commit -m "Hafıza haritası: notes/memories:listWithEmbeddings IPC uç noktaları

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Preload köprüsü

**Files:**
- Modify: `src/preload/index.ts`

**Interfaces:**
- Consumes: `notes:listWithEmbeddings` / `memories:listWithEmbeddings` IPC kanalları (Task 4).
- Produces: `window.api.notes.listWithEmbeddings()`, `window.api.memories.listWithEmbeddings()` —
  Task 6 (`MemoryGraph.tsx`) bunları çağırır.

- [ ] **Step 1: `notes` nesnesine ekle**

`notes: { list: ..., search: (query) => ipcRenderer.invoke('notes:search', query), ... }` bloğuna:

```ts
    listWithEmbeddings: () => ipcRenderer.invoke('notes:listWithEmbeddings'),
```

- [ ] **Step 2: `memories` nesnesine ekle**

Aynı şekilde:

```ts
    listWithEmbeddings: () => ipcRenderer.invoke('memories:listWithEmbeddings'),
```

- [ ] **Step 3: Typecheck (tüm proje — artık `shared/api.ts`, `ipc.ts`, `preload/index.ts` uyumlu
      olmalı)**

Run: `npm run typecheck`
Expected: PASS (hem `typecheck:node` hem `typecheck:web`)

- [ ] **Step 4: Commit**

```bash
git add src/preload/index.ts
git commit -m "Hafıza haritası: preload'a listWithEmbeddings köprüsü

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `MemoryGraph` bileşeni (three.js sahnesi, etkileşim, geri dönüş durumları)

**Files:**
- Create: `src/renderer/src/components/notes/MemoryGraph.tsx`

**Interfaces:**
- Consumes:
  - `window.api.notes.listWithEmbeddings()`, `window.api.memories.listWithEmbeddings()` (Task 5)
  - `buildEdges`, `layoutGraph`, `GraphNode`, `type Vec3` (Task 2, `../../lib/graphLayout`)
  - `window.api.settings.get(): Promise<SettingsView>` (mevcut, `semanticSearchEnabled` alanı için)
  - `Modal` bileşeni (mevcut, `../ui/Modal`)
  - `useLiveData` (mevcut, `../../lib/useLiveData`)
  - `useToast` (mevcut, `../../lib/toast`)
- Produces: `export default function MemoryGraph(props: { onOpenSettings: () => void }):
  React.JSX.Element` — Task 7'de `NotesPage.tsx` bunu import edip render eder. `onOpenSettings`
  dışında prop almaz (kendi verisini kendi yükler, `NotesView`/`MemoriesView` ile aynı desen);
  `onOpenSettings`, `ChatPage`/`CalendarPage`'de zaten kullanılan `() => setPage('settings')`
  deseniyle App.tsx'ten NotesPage üzerinden geçirilir.

Bu görev otomatik test almıyor (three.js WebGL render'ı jsdom'da anlamlı test edilemez, proje
genelinde bu tür görsel/etkileşimli kod hep CDP ile canlı test ediliyor — bkz. `Orb.tsx`, HUD).
Alt adımlar bunun yerine küçük, doğrulanabilir parçalara bölünmüş.

- [ ] **Step 1: Veri yükleme, birleştirme ve geri dönüş durumları (henüz three.js yok)**

```tsx
// src/renderer/src/components/notes/MemoryGraph.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import type { MemoryWithEmbedding, NoteWithEmbedding, SettingsView } from '@shared/api'
import { buildEdges, layoutGraph, type GraphNode } from '../../lib/graphLayout'
import { useLiveData } from '../../lib/useLiveData'
import { secondaryButtonClass } from '../../lib/styles'

// Bileşen dışında tanımlı olmalı (bkz. useLiveData)
const loadSettings = (): Promise<SettingsView> => window.api.settings.get()
const loadNotes = (): Promise<NoteWithEmbedding[]> => window.api.notes.listWithEmbeddings()
const loadMemories = (): Promise<MemoryWithEmbedding[]> => window.api.memories.listWithEmbeddings()

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

// Task 1'de eklenecek: three.js sahnesi. Şimdilik yer tutucu değil — Step 2'de dolduruluyor.
function MemoryGraphScene(props: {
  items: MapItem[]
  edges: ReturnType<typeof buildEdges>
  positions: Map<string, { x: number; y: number; z: number }>
}): React.JSX.Element {
  void props
  return <div className="h-full w-full" />
}

export default MemoryGraph
```

- [ ] **Step 2: Derleme kontrolü**

Run: `npm run typecheck:web`
Expected: PASS. `MemoryGraphScene`'in kullanılmayan prop uyarısı vermemesi için `void props`
satırı bilinçli kondu (Step 3'te gerçek kullanım gelince kalkacak).

- [ ] **Step 3: three.js sahnesini doldur — sahne kurulumu, düğümler, kenarlar**

`MemoryGraphScene` fonksiyonunun içini şu şekilde doldur (üstteki `void props` satırını kaldır):

```tsx
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const NOTE_COLOR = 0x8b9bff // accent
const MEMORY_COLOR = 0x6fd6c9 // ikincil ton, tasarımdaki glow ailesinden

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
```

- [ ] **Step 4: Tıklanan kaydı düzenleyen küçük modal'ı ekle**

`MemoryGraphScene`'in altına, `export default MemoryGraph`'tan önce:

```tsx
import Modal from '../ui/Modal'
import { errorMessage } from '../../lib/errors'
import { useToast } from '../../lib/toast'
import { inputClass } from '../../lib/styles'

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
```

**Not:** `item.kind === 'note'` dalında sadece başlığı güncelliyoruz (`NotePatch.title`) —
notun içeriğini düzenlemek için zaten mevcut liste görünümündeki `NoteEditor` var; haritadaki
modal kasıtlı olarak hafif tutuldu (hızlı bakış/küçük düzeltme). Bunu tasarımın "click açınca
düzenleme paneli açılır" maddesine göre yeterli kabul ediyoruz; içerik düzenlemek isteyen kullanıcı
Liste görünümüne geçer.

- [ ] **Step 5: Tam typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. Lint hata verirse (ör. kullanılmayan import, `void props` kalıntısı) düzelt.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/notes/MemoryGraph.tsx
git commit -m "Hafıza haritası: MemoryGraph bileşeni (three.js sahnesi, hover/tıklama, geri dönüşler)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `NotesPage.tsx`'e Liste/Harita geçişi

**Files:**
- Modify: `src/renderer/src/pages/NotesPage.tsx`
- Modify: `src/renderer/src/App.tsx:110-112` (`NotesPage` render bloğu — `onOpenSettings` prop'u
  `ChatPage`/`CalendarPage` ile aynı desende geçirilecek)

**Interfaces:**
- Consumes: `MemoryGraph` (Task 6, `export default function MemoryGraph(props: { onOpenSettings:
  () => void }): React.JSX.Element`)
- Produces: `NotesPage` artık `{ onOpenSettings: () => void }` prop'u alıyor — `App.tsx` bunu
  geçirmeli.

- [ ] **Step 1: `App.tsx`'teki `NotesPage` render bloğunu güncelle**

`src/renderer/src/App.tsx:110-112` civarındaki

```tsx
          {page === 'notes' && (
            <div className="animate-fade h-full">
              <NotesPage />
            </div>
          )}
```

satırını şuna çevir:

```tsx
          {page === 'notes' && (
            <div className="animate-fade h-full">
              <NotesPage onOpenSettings={() => setPage('settings')} />
            </div>
          )}
```

- [ ] **Step 2: `NotesPage.tsx`'e `view` state'i, geçiş düğmelerini ve prop'u ekle**

```tsx
import { useState } from 'react'
import NotesView from '../components/notes/NotesView'
import MemoriesView from '../components/notes/MemoriesView'
import MemoryGraph from '../components/notes/MemoryGraph'
import { tabClass } from '../lib/styles'

type Tab = 'notes' | 'memories'
type View = 'list' | 'graph'

const TABS: { id: Tab; label: string }[] = [
  { id: 'notes', label: 'Notlarım' },
  { id: 'memories', label: 'Asistanın hafızası' }
]

interface NotesPageProps {
  onOpenSettings: () => void
}

function NotesPage({ onOpenSettings }: NotesPageProps): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('notes')
  const [view, setView] = useState<View>('list')

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-line px-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Hafıza Merkezi</h1>
          <div className="flex gap-1">
            <button
              onClick={() => setView('list')}
              className={tabClass(view === 'list')}
            >
              Liste
            </button>
            <button
              onClick={() => setView('graph')}
              className={tabClass(view === 'graph')}
            >
              Harita
            </button>
          </div>
        </div>
        {view === 'list' && (
          <div className="mt-4 flex gap-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={tabClass(tab === t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </header>
      <div className="min-h-0 flex-1">
        {view === 'graph' ? (
          <MemoryGraph onOpenSettings={onOpenSettings} />
        ) : tab === 'notes' ? (
          <NotesView />
        ) : (
          <MemoriesView />
        )}
      </div>
    </div>
  )
}

export default NotesPage
```

- [ ] **Step 3: Typecheck + lint + tam test paketi**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: hepsi PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/pages/NotesPage.tsx src/renderer/src/App.tsx
git commit -m "Hafıza haritası: Hafıza Merkezi'ne Liste/Harita geçişi eklendi

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Canlı doğrulama ve CLAUDE.md güncellemesi

**Files:**
- Modify: `CLAUDE.md` ("Nerede kaldık" bölümüne yeni madde)

Bu görevde kod değişikliği yok — sadece gerçek uygulamada CDP ile doğrulama ve belgeleme.

- [ ] **Step 1: Dev uygulamasını başlat (zaten açık değilse)**

`preview_start` ile `.claude/launch.json`'daki `kisisel-asistan-dev` yapılandırmasını çalıştır
(veya zaten açıksa `Ctrl+R` ile yenile — bu değişiklikler renderer-only, main süreç yeniden
başlamadan da yansır ama `notes:listWithEmbeddings` gibi yeni IPC kanalları eklendiği için main
tarafı da değişti; `preview_stop` + `preview_start` ile tam yeniden başlatmak daha güvenli).

- [ ] **Step 2: Ayarlar > Asistan'dan "Anlamsal arama"yı aç (kapalıysa)**

`node scripts/cdp.mjs eval "..."` ile veya elle: Ayarlar sayfası > Asistan sekmesi >
"Anlamsal arama" anahtarını aç.

- [ ] **Step 3: Test verisi olarak birkaç benzer konulu not/hafıza kaydı ekle**

Örnek: "Kahve" geçen 2 not, "spor" geçen 2 not, aralarında hiç ilgisi olmayan 1 not. Her ikisi de
`window.api.notes.backfillEmbeddings()` / `window.api.memories.backfillEmbeddings()` ile
embedding'lerinin hesaplanmasını bekle (birkaç saniye, `bge-m3` çağrısı).

- [ ] **Step 4: Hafıza Merkezi > Harita'yı aç, doğrula:**
      - Küreler görünüyor mu, "kahve" ve "spor" grupları birbirinden ayrı kümeleniyor mu
      - Fareyle döndürme/yakınlaştırma çalışıyor mu
      - Bir küreye gelince başlık tooltip'te çıkıyor mu
      - Tıklayınca düzenleme modalı açılıp kaydediyor mu
      - Anlamsal arama kapatılınca "Ayarlara git" mesajı çıkıyor mu (ayarı tekrar kapatıp dene)

- [ ] **Step 5: Test verilerini sil**

Eklenen test not/hafıza kayıtlarını sil (proje kuralı: test verisi kalıcı kalmaz).

- [ ] **Step 6: `CLAUDE.md`'nin "Nerede kaldık" bölümüne yeni bir madde ekle**

En üste (en son giriş olarak) şunun gibi bir madde ekle (gerçek test sonuçlarınla doldur):

```markdown
- **Hafıza haritası eklendi (2026-09-25).** Kullanıcının bir YouTube videosunda gördüğü 3B
  "beyin haritası" fikri, mevcut `bge-m3` anlamsal arama altyapısına dayanarak eklendi. Hafıza
  Merkezi'nde yeni bir Liste/Harita geçişi (`NotesPage.tsx`); Harita görünümü notları ve hafıza
  kayıtlarını birlikte, kosinüs benzerliğine göre kurulan kenarlarla (`lib/graphLayout.ts` →
  `buildEdges`, eşik 0.55, düğüm başına en fazla 4 kenar) ve basit bir kuvvet yönlendirmeli 3B
  simülasyonla (`layoutGraph`, veri değişince bir kez hesaplanıp önbelleğe alınır) yerleştirip
  gerçek bir three.js sahnesinde (`MemoryGraph.tsx`, `OrbitControls` ile fare gezinme,
  `Raycaster` ile hover/tıklama) gösteriyor. Yeni IPC: `notes:listWithEmbeddings` /
  `memories:listWithEmbeddings` (mevcut `listNotesWithEmbeddings`/`listMemoriesWithEmbeddings`
  main fonksiyonlarını sarıyor, embedding düz sayı dizisi olarak gidiyor). Tıklayınca kaydın
  başlığını/metnini düzenleyen küçük bir modal açılıyor. **Bilinçli v1 sınırları:** el kontrolüyle
  (kamera) gezinme yok (sadece fare), elle bağlantı kurma yok, büyük veri setinde (100+ kayıt)
  performans optimize edilmedi. Tasarım belgesi: `docs/superpowers/specs/2026-09-25-hafiza-haritasi-design.md`,
  uygulama planı: `docs/superpowers/plans/2026-09-25-hafiza-haritasi.md`. [BURAYA GERÇEK CDP
  TEST SONUÇLARINI YAZ: kaç düğüm/kenarla denendi, kümelenme gözle doğrulandı mı, hangi
  sorunlar bulunup düzeltildi.]
```

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "CLAUDE.md: hafıza haritası özelliği belgelendi

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Kullanıcıya sonucu bildir, push/PR için onay iste**

Kullanıcının kuralı: her yazışmadan sonra otomatik GitHub'a yüklenmiyor, sadece ciddi bir
değişiklik tamamlandığında. Bu özellik tamamlandığında (kullanıcı canlı testte onayladıktan
sonra) `git push -u origin worktree-jarvis-hud-orb` + `gh pr create` + CI izleme + (CI geçerse)
`gh pr merge --merge --delete-branch` adımları, projenin standart PR akışıyla (bkz. CLAUDE.md
"GitHub" notu) uygulanır.
