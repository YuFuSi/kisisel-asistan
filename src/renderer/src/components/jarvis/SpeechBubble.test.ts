import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SpeechBubble from './SpeechBubble'

describe('SpeechBubble erişilebilir sunum', () => {
  it('tam mesajı tek canlı bölgede sunar; görünür daktilo aria-hidden olur', () => {
    const html = renderToStaticMarkup(createElement(SpeechBubble, { text: 'Merhaba <Pıtır>' }))
    expect(html).toContain('role="status" aria-live="polite" aria-atomic="true"')
    expect(html).toContain('Merhaba &lt;Pıtır&gt;')
    expect(html).toContain('<p aria-hidden="true"')
    expect(html).not.toContain('scale(0.92)')
  })

  it('tonları mevcut tasarım renklerinden ve kuyruğu side değerinden alır', () => {
    for (const [tone, color] of [
      ['approval', 'caution'],
      ['success', 'positive'],
      ['error', 'negative']
    ] as const) {
      const html = renderToStaticMarkup(
        createElement(SpeechBubble, { text: 'Tamam', tone, side: 'right' })
      )
      expect(html).toContain(`border-color:var(--color-${color})`)
      expect(html).toContain('right-6')
      expect(html).toContain('glass relative')
    }
  })

  it('eylem düğmelerini canlı bölgenin dışında erişilebilir tutar', () => {
    const html = renderToStaticMarkup(
      createElement(SpeechBubble, {
        text: 'Onaylıyor musun?',
        tone: 'approval',
        actions: createElement('button', null, 'Onayla')
      })
    )
    expect(html).toContain('<button>Onayla</button>')
    expect(html.indexOf('</span>')).toBeLessThan(html.indexOf('<button>'))
    expect(html).toContain('left-6')
  })
})
