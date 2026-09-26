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

  it("embedding'i olmayan düğümler için kenar kurmaz", () => {
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

  it('kenarsız (bağlantısız) düğümler bile orijinden sınırsız uzaklaşmaz (merkezleme kuvveti)', () => {
    // En kötü durum: hiçbir kenar yok, sadece itme kuvveti var. Merkezleme kuvveti olmadan
    // bu düğümler DEFAULT_ITERATIONS boyunca birbirini iterek orijinden çok uzağa savrulur.
    const nodes: GraphNode[] = Array.from({ length: 9 }, (_, i) => ({
      id: `n${i}`,
      embedding: null
    }))
    const positions = layoutGraph(nodes, [])
    for (const node of nodes) {
      const p = positions.get(node.id)!
      const dist = Math.hypot(p.x, p.y, p.z)
      expect(dist).toBeLessThan(15)
    }
  })
})
