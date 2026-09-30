// Electron penceresini Chrome DevTools Protocol (CDP) ile test etmek için küçük yardımcı.
// Önce uygulama şu şekilde açık olmalı: npm run dev -- --remoteDebuggingPort 9222
//
// Kullanım:
//   node scripts/cdp.mjs eval "<js ifadesi>"
//   node scripts/cdp.mjs waitfor "<js ifadesi>" [timeoutMs]
//   node scripts/cdp.mjs type "<css seçici>" "<metin>"
//   node scripts/cdp.mjs key Enter
//   node scripts/cdp.mjs shot cikti.png
import { writeFileSync } from 'node:fs'

// Kurulu uygulamayı test ederken farklı port verilebilir: $env:CDP_PORT='9223'
const PORT = Number(process.env.CDP_PORT ?? 9222)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getTarget() {
  for (let i = 0; i < 90; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      // Varsayılan ana pencere (adreste # yok); çentik için CDP_HASH=notch
      const hash = process.env.CDP_HASH ? `#${process.env.CDP_HASH}` : ''
      const page = list.find(
        (t) =>
          t.type === 'page' &&
          !t.url.startsWith('devtools://') &&
          (hash ? t.url.endsWith(hash) : !t.url.includes('#'))
      )
      if (page) return page
    } catch {
      // Electron henüz açılmadı
    }
    await sleep(1000)
  }
  throw new Error('Electron sayfası bulunamadı')
}

const [cmd, ...args] = process.argv.slice(2)
const target = await getTarget()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.onopen = resolve
  ws.onerror = reject
})

let nextId = 0
const pending = new Map()
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
  }
}
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })

async function evaluate(source) {
  // DOM elemanları (ör. querySelector sonucu) JSON'a çevrilemez; true'ya dönüştür
  const expression = `Promise.resolve((${source})).then((v) => (v instanceof Node ? true : v))`
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  }
  return r.result.value
}

try {
  switch (cmd) {
    case 'eval':
      console.log(JSON.stringify(await evaluate(args[0]), null, 2))
      break
    case 'waitfor': {
      const timeout = Number(args[1] ?? 180000)
      const start = Date.now()
      let value
      while (!(value = await evaluate(args[0]))) {
        if (Date.now() - start > timeout) throw new Error(`Zaman aşımı: ${args[0]}`)
        await sleep(500)
      }
      console.log(`OK (${Date.now() - start} ms)`, JSON.stringify(value))
      break
    }
    case 'type':
      await evaluate(`document.querySelector(${JSON.stringify(args[0])}).focus()`)
      await send('Input.insertText', { text: args[1] })
      console.log('yazıldı')
      break
    case 'key': {
      // "Enter", "Escape" veya "Ctrl+N" gibi yazılır
      const parts = args[0].split('+')
      const name = parts.pop()
      const flags = { alt: 1, ctrl: 2, meta: 4, shift: 8 }
      const modifiers = parts.reduce((sum, p) => sum | (flags[p.toLowerCase()] ?? 0), 0)
      const single = name.length === 1
      const codes = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8 }
      await send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        key: name,
        code: single ? `Key${name.toUpperCase()}` : name,
        windowsVirtualKeyCode: single ? name.toUpperCase().charCodeAt(0) : (codes[name] ?? 0),
        modifiers
      })
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: name,
        code: single ? `Key${name.toUpperCase()}` : name,
        windowsVirtualKeyCode: single ? name.toUpperCase().charCodeAt(0) : (codes[name] ?? 0),
        modifiers
      })
      console.log('tuş gönderildi')
      break
    }
    case 'upload': {
      // Gizli <input type="file"> kutusuna gerçek dosyalar verir (seçme penceresi açılmadan)
      const { root } = await send('DOM.getDocument', { depth: 0 })
      const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: args[0] })
      if (!nodeId) throw new Error(`Eleman bulunamadı: ${args[0]}`)
      await send('DOM.setFileInputFiles', { nodeId, files: args.slice(1) })
      console.log('dosya verildi')
      break
    }
    case 'drop': {
      // Gerçek sürükle-bırak: drop x y dosya... (sayfa koordinatları; Chromium'un kendi olaylarıyla)
      const [x, y] = [Number(args[0]), Number(args[1])]
      const data = { items: [], files: args.slice(2), dragOperationsMask: 1 }
      for (const type of ['dragEnter', 'dragOver', 'drop']) {
        await send('Input.dispatchDragEvent', { type, x, y, data })
        await sleep(150)
      }
      console.log('bırakıldı')
      break
    }
    case 'shot': {
      const r = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(args[0], Buffer.from(r.data, 'base64'))
      console.log('kaydedildi', args[0])
      break
    }
    default:
      throw new Error(`Bilinmeyen komut: ${cmd}`)
  }
} finally {
  ws.close()
}
