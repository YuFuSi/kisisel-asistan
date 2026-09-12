import { describe, expect, it } from 'vitest'
import { describeWeatherCode } from './weather'

describe('describeWeatherCode', () => {
  it('bilinen kodları Türkçe açıklamaya çevirir', () => {
    expect(describeWeatherCode(0)).toBe('Açık')
    expect(describeWeatherCode(3)).toBe('Kapalı')
    expect(describeWeatherCode(65)).toBe('Şiddetli yağmur')
    expect(describeWeatherCode(95)).toBe('Gök gürültülü fırtına')
  })

  it('bilinmeyen kodda genel bir açıklama döner', () => {
    expect(describeWeatherCode(123)).toBe('Bilinmeyen hava durumu')
  })
})
