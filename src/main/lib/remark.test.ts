import { describe, expect, it } from 'vitest'
import { cleanRemark } from './remark'

describe('cleanRemark', () => {
  it('ilk satırı ve tırnaksız hâli alır', () => {
    expect(cleanRemark('"Bu kedi videosu çok tatlı görünüyor!"\nBaşka satır')).toBe(
      'Bu kedi videosu çok tatlı görünüyor!'
    )
  })

  it('Türkçe olmayan veya çok uzun/kısa çıktıyı reddeder', () => {
    expect(cleanRemark('The user is watching a video about cats')).toBeNull()
    expect(cleanRemark('用户正在看视频')).toBeNull()
    expect(cleanRemark('Harika')).toBeNull()
    expect(cleanRemark('bu '.repeat(30))).toBeNull()
    expect(cleanRemark('')).toBeNull()
  })
})
