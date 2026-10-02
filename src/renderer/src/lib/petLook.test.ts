import { describe, expect, it } from 'vitest'
import { toolIcon } from './petLook'

describe('toolIcon', () => {
  it('hava durumu aracı için simge döndürür', () => {
    expect(toolIcon('hava_durumu')).not.toBeNull()
  })

  it('bilinmeyen araç için null döndürür', () => {
    expect(toolIcon('bilinmeyen_arac')).toBeNull()
  })

  it.each([null, undefined])('araç adı %s olduğunda null döndürür', (toolName) => {
    expect(toolIcon(toolName)).toBeNull()
  })
})
