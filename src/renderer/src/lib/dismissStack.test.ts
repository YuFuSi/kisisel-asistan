import { describe, expect, it, vi } from 'vitest'
import { createDismissStack } from './dismissStack'

describe('Escape katman sırası', () => {
  it('son açılan alt katman yerine en üst görsel katmanı kapatır', () => {
    const stack = createDismissStack()
    const voice = vi.fn()
    const modal = vi.fn()
    stack.add(50, modal)
    stack.add(40, voice)
    expect(stack.dismissTop()).toBe(true)
    expect(modal).toHaveBeenCalledOnce()
    expect(voice).not.toHaveBeenCalled()
  })
  it('aynı seviyede son açılanı kapatır, kaldırılınca önceki katmana döner', () => {
    const stack = createDismissStack()
    const first = vi.fn()
    const last = vi.fn()
    const removeFirst = stack.add(50, first)
    const removeLast = stack.add(50, last)
    stack.dismissTop()
    expect(last).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
    removeLast()
    stack.dismissTop()
    expect(first).toHaveBeenCalledOnce()
    removeFirst()
    removeFirst()
    expect(stack.dismissTop()).toBe(false)
  })
})
