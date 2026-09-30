import { build } from 'esbuild'
import { readdir } from 'node:fs/promises'
import { mkdtempSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Gerçek Chromium'da, uygulama verisine ve mikrofonuna erişmeden ortak UI davranışlarını dener.
// Çalıştırma: node scripts/check-accessibility.mjs
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const electron = createRequire(import.meta.url)('electron')
const { app, BrowserWindow } = electron
const profile = process.env.JARVIS_F1_TEST_PROFILE
if (app) app.setPath('userData', profile)
let window
let exitCode = 1
app?.on('window-all-closed', () => {})

const fixture = `
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import Modal from './src/renderer/src/components/ui/Modal'
import Tabs from './src/renderer/src/components/ui/Tabs'
import Toggle from './src/renderer/src/components/ui/Toggle'
import Composer from './src/renderer/src/components/chat/Composer'
import TaskItem from './src/renderer/src/components/tasks/TaskItem'
import CommandPalette from './src/renderer/src/components/CommandPalette'
import ChatPage from './src/renderer/src/pages/ChatPage'
import ToastProvider from './src/renderer/src/components/ui/ToastProvider'
import ApprovalDock from './src/renderer/src/components/jarvis/ApprovalDock'
import { useAssistantState, useVisibleConversation, usePendingApprovals } from './src/renderer/src/lib/assistantState'
import { setSfxEnabled } from './src/renderer/src/lib/soundEffects'
import { requestOpenConversation } from './src/renderer/src/lib/chatRequests'
import { useDismissLayer } from './src/renderer/src/lib/useDismissLayer'
import { useReducedMotion } from './src/renderer/src/lib/useReducedMotion'

window.legacyEscapes = 0
window.voiceEscapes = 0
window.addEventListener('keydown', e => { if (e.key === 'Escape') window.legacyEscapes++ })
function Fixture() {
  const [open, setOpen] = useState(false)
  const [nested, setNested] = useState(false)
  const [palette, setPalette] = useState(false)
  const [tab, setTab] = useState('one')
  const reduced = useReducedMotion()
  useDismissLayer(true, 40, () => window.voiceEscapes++)
  return <>
    <button id="opener" onClick={() => setOpen(true)}>Aç</button>
    <button id="palette" onClick={() => setPalette(true)}>Palet</button>
    <output id="motion">{String(reduced)}</output>
    <span id="loading" className="animate-bounce">Yükleniyor</span>
    <Tabs value={tab} onChange={setTab} items={[{id:'one',label:'Bir'},{id:'two',label:'İki'},{id:'three',label:'Üç'}]} />
    <Toggle label="Deneme" checked={false} onChange={() => {}} />
    <Composer busy={false} disabled={false} attaching={false} attachments={[{path:'demo.txt',name:'demo.txt',partCount:1}]} onSend={() => {}} onStop={() => {}} onAttachFiles={() => {}} onRemoveAttachment={() => {}} />
    <ul><TaskItem task={{id:1,title:'Deneme',doneAt:null,dueDate:null,dueTime:null}} onToggle={() => {}} onRename={() => {}} onDelete={() => {}} /></ul>
    <Modal open={open} title="Deneme penceresi" onClose={() => setOpen(false)}>
      <button id="cancel" onClick={() => setOpen(false)}>Vazgeç</button>
      <button disabled>Devre dışı</button><button hidden>Gizli</button>
      <button id="nested" onClick={() => setNested(true)}>İkinci pencere</button>
      <Modal open={nested} title="İkinci pencere" onClose={() => setNested(false)}><button id="inner" onClick={() => setNested(false)}>Kapat</button></Modal>
    </Modal>
    {palette && <CommandPalette currentPage="home" onClose={() => setPalette(false)} onNavigate={() => {}} />}
  </>
}
const reactRoot = createRoot(document.getElementById('root'))
flushSync(() => reactRoot.render(<Fixture />))
const wait = () => new Promise(resolve => setTimeout(resolve, 100))
function assert(value, message) { if (!value) throw new Error(message) }
function key(target, code, shiftKey = false) { target.dispatchEvent(new KeyboardEvent('keydown', {key:code, shiftKey, bubbles:true, cancelable:true})) }
window.runChecks = async () => {
  await wait()
  const opener = document.getElementById('opener')
  opener.focus(); opener.click(); await wait()
  assert(document.activeElement.id === 'cancel', 'Modal ilk odağı güvenli düğmeye vermedi: ' + document.activeElement.outerHTML)
  const dialog = document.querySelector('[role="dialog"]')
  assert(dialog.getAttribute('aria-modal') === 'true' && document.getElementById(dialog.getAttribute('aria-labelledby')).textContent === 'Deneme penceresi', 'Modal adı eksik')
  key(document.activeElement, 'Tab', true)
  assert(document.activeElement.id === 'nested', 'Shift+Tab odak tuzağı çalışmadı')
  key(document.activeElement, 'Tab')
  assert(document.activeElement.id === 'cancel', 'Tab odak tuzağı çalışmadı')
  opener.focus()
  // Görünmez offscreen pencere yerel odak olayını üretmediği için olay ayrıca gönderilir.
  opener.dispatchEvent(new FocusEvent('focusin', {bubbles:true}))
  assert(document.activeElement.id === 'cancel', 'Programatik odak modal dışına kaçtı')
  document.getElementById('nested').focus(); document.getElementById('nested').click(); await wait()
  assert(document.activeElement.id === 'inner', 'İç modal odağı almadı')
  key(document.activeElement, 'Escape'); await wait()
  assert(document.querySelectorAll('[role="dialog"]').length === 1 && document.activeElement.id === 'nested', 'Escape iki modalı kapattı veya odak dönmedi')
  key(document.activeElement, 'Escape'); await wait()
  assert(!document.querySelector('[role="dialog"]') && document.activeElement === opener, 'Modal kapanınca odak geri gelmedi')
  assert(window.voiceEscapes === 0 && window.legacyEscapes === 0, 'Escape alt katmana sızdı')
  const palette = document.getElementById('palette'); palette.focus(); palette.click(); await wait()
  assert(document.activeElement.getAttribute('aria-label') === 'Komut ara', 'Palet odağı almadı')
  key(document.activeElement, 'Escape'); await wait()
  assert(!document.querySelector('[role="dialog"]') && document.activeElement === palette, 'Palet odağı geri vermedi')
  assert(window.voiceEscapes === 0, 'Palet Escape sesi de kapattı')
  let tabs = [...document.querySelectorAll('[role="tab"]')]
  assert(tabs.filter(tab => tab.tabIndex === 0).length === 1, 'Sekmeler birden fazla Tab durağı oluşturdu')
  tabs[0].focus(); key(tabs[0], 'ArrowLeft'); await wait()
  assert(document.activeElement.textContent === 'Üç', 'Sol ok baştan sona sarmadı')
  key(document.activeElement, 'Home'); await wait()
  assert(document.activeElement.textContent === 'Bir', 'Home ilk sekmeye geçmedi')
  key(document.activeElement, 'End'); await wait()
  assert(document.activeElement.textContent === 'Üç', 'End son sekmeye geçmedi')
  key(document.activeElement, 'ArrowRight'); await wait()
  assert(document.activeElement.textContent === 'Bir', 'Sağ ok sondan başa sarmadı')
  for (const label of ['demo.txt belgesini kaldır', 'Belge ekle', 'Sesli yaz', 'Gönder', 'Tamamlandı olarak işaretle', 'Görevi düzenle', 'Görevi sil', 'Deneme']) {
    const element = document.querySelector('[aria-label="' + label + '"]')
    const rect = element.getBoundingClientRect()
    assert(rect.width >= 32 && rect.height >= 32, label + ': tıklama alanı 32px altında')
  }
  return 'Modal/palet odağı, iç içe Escape, sekme tuşları ve 8 tıklama alanı geçti.'
}
window.runChatChecks = async () => {
  setSfxEnabled(false)
  const listeners = new Set()
  const approvalResponses = []
  const history = Array.from({length:40}, (_,index) => ({id:index+1, conversationId:1, role:index%2 ? 'assistant':'user', content:'Uzun sohbet kaydı ' + index + '. '.repeat(400), tools:[], createdAt:new Date().toISOString()}))
  window.api = {
    settings:{get:async () => ({provider:'ollama',models:{ollama:'test'},hasSecret:{},speakReplies:false})},
    conversations:{list:async () => [{id:1,title:'Deneme sohbeti',updatedAt:new Date().toISOString(),pinned:false}],messages:async () => history},
    tasks:{list:async () => []},reminders:{list:async () => []},
    events:{onDataChanged:() => () => {},onCommand:() => () => {}},
    chat:{onEvent: listener => {listeners.add(listener);return () => listeners.delete(listener)},stop:async () => {},respondToApproval:async (id,approved) => approvalResponses.push([id,approved]),send:async () => ({id:43,conversationId:1,role:'user',content:'Deneme isteği',tools:[],createdAt:new Date().toISOString()})},
    voice:{stopSpeaking:async () => {}}
  }
  function StateProbe() {
    const state = useAssistantState()
    const visible = useVisibleConversation()
    const approvals = usePendingApprovals()
    return <output id="shared-state">{state + ':' + visible + ':' + approvals.length}</output>
  }
  const renderChat = active => flushSync(() => reactRoot.render(<ToastProvider><div style={{height:600,position:'relative'}}><ChatPage active={active} onOpenSettings={() => {}} /><ApprovalDock onOpenConversation={() => {}} /><StateProbe /></div></ToastProvider>))
  renderChat(true)
  await wait(); requestOpenConversation(1); await wait()
  const scroll = [...document.querySelectorAll('div')].find(element => element.className.includes('min-h-0 flex-1 flex-col overflow-y-auto'))
  assert(scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight <= 2, 'Sohbet ilk açılışta sona gitmedi')
  scroll.scrollTop = 100; scroll.dispatchEvent(new Event('scroll',{bubbles:true})); await wait()
  const before = scroll.scrollTop
  const emit = message => listeners.forEach(listener => listener({type:'stopped',conversationId:1,message}))
  emit({id:41,conversationId:1,role:'assistant',content:'Yeni yanıt. '.repeat(100),tools:[],createdAt:new Date().toISOString()}); await wait()
  assert(scroll.scrollTop === before, 'Yeni yanıt geçmişi okuyan kullanıcıyı aşağı çekti')
  let latest = [...document.querySelectorAll('button')].find(button => button.textContent === 'Yeni yanıt')
  assert(latest, 'Yeni yanıt düğmesi görünmedi')
  latest.click(); await new Promise(resolve => setTimeout(resolve,700))
  assert(scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight <= 2, 'Yeni yanıt düğmesi sona götürmedi: ' + [scroll.scrollHeight,scroll.scrollTop,scroll.clientHeight])
  emit({id:42,conversationId:1,role:'assistant',content:'Sonraki yanıt. '.repeat(100),tools:[],createdAt:new Date().toISOString()}); await wait()
  assert(scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight <= 2, 'Sona dönüşten sonra takip yeniden başlamadı')
  const composer = document.getElementById('composer-input')
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(composer,'Deneme isteği')
  composer.dispatchEvent(new Event('input',{bubbles:true})); await wait()
  key(composer,'Enter'); await wait()
  scroll.scrollTop = 100; scroll.dispatchEvent(new Event('scroll',{bubbles:true})); await wait()
  const duringStream = scroll.scrollTop
  listeners.forEach(listener => listener({type:'delta',conversationId:1,text:'Akış parçası. '.repeat(100)})); await wait()
  assert(scroll.scrollTop === duringStream, 'Akış parçası geçmişi okuyan kullanıcıyı aşağı çekti')
  latest = [...document.querySelectorAll('button')].find(button => button.textContent === 'Yeni yanıt')
  assert(latest, 'Akış sırasında yeni yanıt düğmesi görünmedi')
  latest.click(); await wait()
  assert(scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight <= 2, 'Akış sırasında sona dönüş başarısız')
  listeners.forEach(listener => listener({type:'delta',conversationId:1,text:'Devam. '.repeat(100)})); await wait()
  assert(scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight <= 2, 'Akış takibi yeniden başlamadı')
  scroll.scrollTop = 100; scroll.dispatchEvent(new Event('scroll',{bubbles:true})); await wait()
  const beforeApproval = scroll.scrollTop
  listeners.forEach(listener => listener({type:'approval',conversationId:1,approval:{id:'test-approval',toolName:'test',label:'Deneme onayı',summary:'Sadece test yüzeyi',details:'Gerçek işlem yapılmaz'}})); await wait()
  assert(scroll.scrollTop === beforeApproval, 'Ortak onay kartı kaydırma konumunu değiştirdi')
  assert(document.body.textContent.includes('Deneme onayı'), 'Ortak onay sohbet içinde görünmedi')
  assert(!document.querySelector('[aria-label="Onay bekleyen işlem"]'), 'Onay sohbet ve Dock içinde iki kez göründü')
  assert(document.getElementById('shared-state').textContent === 'approval:1:1', 'Ortak onay/visibleConversation modeli güncellenmedi')
  renderChat(false); await wait()
  assert(document.querySelector('[aria-label="Onay bekleyen işlem"]'), 'Sohbetten ayrılınca ApprovalDock görünmedi')
  assert(document.getElementById('shared-state').textContent === 'approval:null:1', 'Sohbetten ayrılınca görünür kimlik temizlenmedi')
  renderChat(true); await wait()
  assert(!document.querySelector('[aria-label="Onay bekleyen işlem"]'), 'Sohbete dönünce Dock tekrarlandı')
  const approve = [...document.querySelectorAll('button')].find(button => button.textContent === 'Onayla')
  approve.click(); await wait()
  assert(approvalResponses.length === 1 && approvalResponses[0][0] === 'test-approval' && approvalResponses[0][1] === true, 'Onay ortak respondToApproval üzerinden yanıtlanmadı')
  assert(!document.body.textContent.includes('Deneme onayı'), 'Yanıtlanan ortak onay kartı kalkmadı')
  listeners.forEach(listener => listener({type:'stopped',conversationId:1})); await wait()
  window.api.chat.send = async () => {throw new Error('Deneme gönderim hatası')}
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(composer,'Hata denemesi')
  composer.dispatchEvent(new Event('input',{bubbles:true})); await wait(); key(composer,'Enter'); await wait()
  assert(document.getElementById('shared-state').textContent === 'idle:1:0', 'Erken gönderim hatasında noteReplyFailed durumu temizlemedi')
  return 'Gerçek ChatPage: kaydırma/akış, F0 ortak onayı, sayfa değişiminde ApprovalDock ve erken gönderim hatası geçti.'
}
`

async function run() {
  try {
    await app.whenReady()
    const bundle = await build({
      stdin: { contents: fixture, resolveDir: root, loader: 'tsx' },
      bundle: true,
      write: false,
      platform: 'browser',
      jsx: 'automatic',
      tsconfig: join(root, 'tsconfig.web.json'),
      plugins: [
        {
          name: 'orb-test-double',
          setup(builder) {
            // Küre Claude'un alanı; bu test yalnızca sohbet yerleşimini ve ortak UI'ı ölçer.
            builder.onResolve({ filter: /jarvis\/Orb$/ }, () => ({
              path: 'orb',
              namespace: 'test-orb'
            }))
            builder.onLoad({ filter: /.*/, namespace: 'test-orb' }, () => ({
              contents: 'export default function Orb(){return null}',
              loader: 'js'
            }))
          }
        }
      ],
      define: { 'process.env.NODE_ENV': '"production"' }
    })
    window = new BrowserWindow({
      show: false,
      width: 1360,
      height: 860,
      webPreferences: { backgroundThrottling: false, offscreen: true }
    })
    const assets = join(root, 'out', 'renderer', 'assets')
    const css = (await readdir(assets)).find((name) => name.endsWith('.css'))
    if (!css) throw new Error('Önce electron-vite build çalıştırılmalı.')
    const { readFile } = await import('node:fs/promises')
    const styles = await readFile(join(assets, css), 'utf8')
    await window.loadURL(
      'data:text/html;charset=utf-8,' + encodeURIComponent('<div id="root"></div>')
    )
    await window.webContents.insertCSS(styles)
    await window.webContents.executeJavaScript(bundle.outputFiles[0].text)
    console.log(await window.webContents.executeJavaScript('window.runChecks()'))
    window.webContents.debugger.attach('1.3')
    for (const value of ['reduce', 'no-preference']) {
      await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value }]
      })
      const reduced = value === 'reduce'
      await window.webContents.executeJavaScript('new Promise(resolve => setTimeout(resolve, 100))')
      const actual = await window.webContents.executeJavaScript(
        'document.getElementById("motion").textContent'
      )
      if (actual !== String(reduced))
        throw new Error('Canlı reduced-motion aboneliği güncellenmedi.')
      const animation = await window.webContents.executeJavaScript(
        'getComputedStyle(document.getElementById("loading")).animationName'
      )
      if ((animation === 'none') !== reduced)
        throw new Error('CSS yükleme hareketi tercihi izlemedi.')
    }
    console.log('Açık pencerede reduced-motion açma/kapatma geçti.')
    console.log(await window.webContents.executeJavaScript('window.runChatChecks()'))
    window.webContents.debugger.detach()
    exitCode = 0
  } catch (error) {
    console.error(error)
    exitCode = 1
  } finally {
    window?.destroy()
    app.exit(exitCode)
  }
}
// Kullanıcı geçici profilleri elle temizleyecek; bu betik profil silmez.
async function launch() {
  const temporaryProfile = mkdtempSync(join(tmpdir(), 'jarvis-f1-check-'))
  try {
    const child = spawn(electron, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, JARVIS_F1_TEST_PROFILE: temporaryProfile },
      stdio: 'inherit',
      windowsHide: true
    })
    process.exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (code) => resolve(code ?? 1))
    })
  } finally {
    console.log('Elle temizlenecek geçici Chromium profili: ' + temporaryProfile)
  }
}
void (app ? run() : launch())
