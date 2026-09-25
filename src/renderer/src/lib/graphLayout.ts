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
 * Eşiği geçen tüm çiftleri benzerliğe göre büyükten küçüğe sıralayıp açgözlü (greedy) şekilde
 * kenar olarak ekler; bir çift, iki ucundaki düğüm de hâlâ `maxPerNode`'un altındaysa eklenir.
 * Not: sadece "kaynak düğümün en iyi N komşusu" seçmek yetmez — başka düğümler de aynı düğümü
 * kendi en iyi komşusu olarak seçebilir ve toplam derece maxPerNode'u aşabilir. Bu yüzden derece
 * sınırı global olarak (her iki uçta da) uygulanır.
 */
export function buildEdges(
  nodes: GraphNode[],
  threshold = DEFAULT_THRESHOLD,
  maxPerNode = DEFAULT_MAX_PER_NODE
): GraphEdge[] {
  const pairs: GraphEdge[] = []
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]
    if (!a.embedding) continue
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]
      if (!b.embedding) continue
      const strength = cosineSimilarity(a.embedding, b.embedding)
      if (strength >= threshold) pairs.push({ source: a.id, target: b.id, strength })
    }
  }
  pairs.sort((x, y) => y.strength - x.strength)

  const degree = new Map<string, number>()
  const edges: GraphEdge[] = []
  for (const pair of pairs) {
    const sourceDegree = degree.get(pair.source) ?? 0
    const targetDegree = degree.get(pair.target) ?? 0
    if (sourceDegree >= maxPerNode || targetDegree >= maxPerNode) continue
    edges.push(pair)
    degree.set(pair.source, sourceDegree + 1)
    degree.set(pair.target, targetDegree + 1)
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
