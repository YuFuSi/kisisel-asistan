import { describe, expect, it } from 'vitest'
import { classifyActivity } from './activity'

const classify = (process: string, title: string, fullscreen = false): string =>
  classifyActivity({ process, title, fullscreen }).kind

describe('classifyActivity', () => {
  it('tarayıcıda siteye göre ayırır', () => {
    expect(classify('chrome', 'Kedi videoları - YouTube - Google Chrome')).toBe('video')
    expect(classify('msedge', 'YouTube Music - Microsoft Edge')).toBe('music')
    expect(classify('firefox', 'Google Meet - Mozilla Firefox')).toBe('meeting')
    expect(classify('chrome', 'Haberler - Google Chrome')).toBe('browse')
  })

  it('program adına göre ayırır', () => {
    expect(classify('Code', 'App.tsx - Kişisel Asistan - Visual Studio Code')).toBe('code')
    expect(classify('Spotify', 'Tarkan - Kuzu Kuzu')).toBe('music')
    expect(classify('WINWORD.EXE', 'Ödev.docx - Word')).toBe('document')
    expect(classify('Discord', '#genel')).toBe('chat')
  })

  it('bilinmeyen tam ekran program oyundur', () => {
    expect(classify('eldenring', 'ELDEN RING', true)).toBe('game')
    expect(classify('eldenring', 'ELDEN RING', false)).toBe('other')
  })

  it('Jarvis ve masaüstü ayrı tutulur', () => {
    expect(classify('kisisel-asistan', 'Jarvis')).toBe('jarvis')
    expect(classify('explorer', '')).toBe('desktop')
  })

  it('video başlığını temizler', () => {
    expect(
      classifyActivity({
        process: 'chrome',
        title: '(3) Kedi videoları - YouTube - Google Chrome',
        fullscreen: true
      })
    ).toEqual({ kind: 'video', detail: 'Kedi videoları', fullscreen: true })
  })
})
