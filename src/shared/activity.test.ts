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

  it.each(['blutv', 'max', 'gain', 'tod', 'exxen', 'tvplus'])(
    '%s uygulamasını video olarak tanır',
    (process) => {
      expect(classify(process, 'Dizi')).toBe('video')
    }
  )

  it.each(['BluTV', 'Max', 'Gain', 'TOD', 'Exxen', 'TV+'])(
    '%s sitesini tarayıcıda video olarak tanır',
    (site) => {
      expect(classify('chrome', `${site} - Google Chrome`)).toBe('video')
    }
  )

  it('Max ifadesinin başka bir kelimenin parçası olmasını video saymaz', () => {
    expect(classify('chrome', 'Maximum sonuçlar - Google Chrome')).toBe('browse')
  })

  it.each(['fizy', 'applemusic'])('%s uygulamasını müzik olarak tanır', (process) => {
    expect(classify(process, 'Şarkı')).toBe('music')
  })

  it.each(['Apple Music', 'Fizy'])('%s sitesini tarayıcıda müzik olarak tanır', (site) => {
    expect(classify('chrome', `${site} - Google Chrome`)).toBe('music')
  })

  it('BiP uygulamasını ve sitesini sohbet olarak tanır', () => {
    expect(classify('bip', 'Sohbetler')).toBe('chat')
    expect(classify('chrome', 'BiP - Google Chrome')).toBe('chat')
  })

  it('WhatsApp masaüstü uygulamasını sohbet olarak tanır', () => {
    expect(classify('whatsapp', 'Sohbetler')).toBe('chat')
  })

  it.each(['Canva', 'Google Slides', 'Google Slaytlar'])(
    '%s sitesini tarayıcıda belge olarak tanır',
    (site) => {
      expect(classify('chrome', `Sunum - ${site} - Google Chrome`)).toBe('document')
    }
  )

  it('Canva uygulamasını belge olarak tanır', () => {
    expect(classify('canva', 'Tasarım')).toBe('document')
  })

  it('LibreOffice uygulamasını belge olarak tanır', () => {
    expect(classify('soffice', 'Sunum')).toBe('document')
  })

  it.each(['studio64', 'sublime_text', 'notepad++'])(
    '%s uygulamasını kod olarak tanır',
    (process) => {
      expect(classify(process, 'Proje dosyası')).toBe('code')
    }
  )

  it('Google Meet sitesini tarayıcıda toplantı olarak tanır', () => {
    expect(classify('chrome', 'Google Meet - Google Chrome')).toBe('meeting')
  })

  it.each(['zoom', 'teams', 'ms-teams.exe'])('%s uygulamasını toplantı olarak tanır', (process) => {
    expect(classify(process, 'Toplantı')).toBe('meeting')
  })

  it('bilinmeyen tam ekran program oyundur', () => {
    expect(classify('eldenring', 'ELDEN RING', true)).toBe('game')
    expect(classify('eldenring', 'ELDEN RING', false)).toBe('other')
  })

  it('Pıtır ve masaüstü ayrı tutulur', () => {
    expect(classify('kisisel-asistan', 'Pıtır')).toBe('jarvis')
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
