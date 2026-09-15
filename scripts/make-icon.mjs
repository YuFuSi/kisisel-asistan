// Jarvis uygulama simgesini üretir: build/icon.png (512), build/icon.ico (16-256), resources/icon.png (256).
// Çalıştırma: npx electron scripts/make-icon.mjs
import { app, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]

// Koyu lacivert yuvarlak kare üzerinde ışıyan mavi halka ve ses dalgası (arayüzdeki küre gibi)
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="72%">
      <stop offset="0" stop-color="#0e2757"/>
      <stop offset="1" stop-color="#040914"/>
    </radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8fe8ff"/>
      <stop offset="0.45" stop-color="#3cc4ff"/>
      <stop offset="1" stop-color="#2f7dff"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="16"/>
    </filter>
  </defs>
  <rect x="12" y="12" width="488" height="488" rx="116" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="148" fill="none" stroke="#3cc4ff" stroke-width="52" opacity="0.5" filter="url(#glow)"/>
  <circle cx="256" cy="256" r="148" fill="none" stroke="url(#ring)" stroke-width="36"/>
  <path d="M168 258 h36 l22 -54 l30 108 l28 -78 l18 24 h42" fill="none" stroke="#c9f4ff"
        stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

/** PNG görüntülerden ICO dosyası (Windows Vista ve sonrası PNG gömülü ICO destekler) */
function buildIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  const entries = []
  let offset = 6 + images.length * 16
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    offset += png.length
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)])
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width: 1024,
    height: 1024,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true }
  })
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${SVG}</body></html>`
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise((resolve) => setTimeout(resolve, 500))
  const image = await window.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 })

  const png = (size) => image.resize({ width: size, height: size, quality: 'best' }).toPNG()
  writeFileSync(join(root, 'build', 'icon.png'), png(512))
  writeFileSync(join(root, 'resources', 'icon.png'), png(256))
  writeFileSync(
    join(root, 'build', 'icon.ico'),
    buildIco(ICO_SIZES.map((size) => ({ size, png: png(size) })))
  )
  console.log('Simge dosyaları yazıldı: build/icon.png, build/icon.ico, resources/icon.png')
  app.quit()
})
