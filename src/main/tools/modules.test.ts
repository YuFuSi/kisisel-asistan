import { describe, expect, it } from 'vitest'
import { modules } from './index'

// Yeni araç eklenirken risk seviyesi veya etiketi unutulursa test başarısız olur
describe('araç modülleri', () => {
  it('her aracın etiketi ve risk seviyesi tanımlı', () => {
    for (const module of modules) {
      const names = Object.keys(module.tools).sort()
      expect(Object.keys(module.labels).sort()).toEqual(names)
      expect(Object.keys(module.risks).sort()).toEqual(names)
    }
  })

  it('kendi onayını gösteren araçlar gerçekten var ve okuma aracı değil', () => {
    for (const module of modules) {
      for (const name of module.selfApproval ?? []) {
        expect(module.tools[name], name).toBeDefined()
        expect(module.risks[name], name).not.toBe('read')
      }
    }
  })
})
