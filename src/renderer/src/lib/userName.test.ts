import { describe, expect, it } from 'vitest'
import { findUserName } from './userName'

describe('findUserName', () => {
  it('hitap tercihini tam addan önce seçer', () => {
    expect(
      findUserName([
        'Kullanıcının tam adı Yusuf Ali Buğra Lüleci, ancak Yusuf diye hitap edilmesini tercih eder.'
      ])
    ).toBe('Yusuf')
  })

  it('düz "adı X" cümlesini tanır', () => {
    expect(findUserName(['Kullanıcının adı Ayşe.'])).toBe('Ayşe')
  })

  it('ad yoksa null döner', () => {
    expect(findUserName(['Kedisinin adı Pamuk, 3 yaşında.'])).toBeNull()
  })
})
