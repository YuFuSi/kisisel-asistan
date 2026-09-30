import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
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
import ActivitySurface from './src/renderer/src/components/chat/ActivitySurface'
import ChatPage from './src/renderer/src/pages/ChatPage'
import Sidebar from './src/renderer/src/components/Sidebar'
import PlanningPage from './src/renderer/src/pages/PlanningPage'
import CalendarPage from './src/renderer/src/pages/CalendarPage'
import MemoriesView from './src/renderer/src/components/notes/MemoriesView'
import AnalyticsPage from './src/renderer/src/pages/AnalyticsPage'
import SettingsPage from './src/renderer/src/pages/SettingsPage'
import HomePage from './src/renderer/src/pages/HomePage'
import ToastProvider from './src/renderer/src/components/ui/ToastProvider'
import ApprovalDock from './src/renderer/src/components/jarvis/ApprovalDock'
import { useAssistantState, useVisibleConversation, usePendingApprovals } from './src/renderer/src/lib/assistantState'
import { setSfxEnabled } from './src/renderer/src/lib/soundEffects'
import { requestOpenConversation } from './src/renderer/src/lib/chatRequests'
import { useDismissLayer } from './src/renderer/src/lib/useDismissLayer'
import { useReducedMotion } from './src/renderer/src/lib/useReducedMotion'

window.api = {conversations:{list:async()=>[]},events:{onDataChanged:()=>()=>{}}}
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
    <span id="loading" className="animate-spin">Yükleniyor</span>
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
  const savedActivity = {id:44,conversationId:1,role:'assistant',content:'İşlem durduruldu.',outcome:'timeout',tools:[{id:'persisted-step',name:'test',label:'Kaydedilmiş işlem',status:'done',input:{örnek:true},result:'Kayıtlı sonuç'}],createdAt:new Date().toISOString()}
  history.push(savedActivity)
  listeners.forEach(listener => listener({type:'stopped',conversationId:1,message:savedActivity})); await wait()
  const savedKey = savedActivity.conversationId + ':' + savedActivity.id + ':' + savedActivity.createdAt
  assert(JSON.parse(localStorage.getItem('jarvis.activity-outcomes.v1'))[savedKey]==='stopped','F0 sonucu kalıcı mesaj kimliğine bağlanmadı')
  flushSync(()=>reactRoot.render(null)); await wait(); renderChat(true); await wait(); requestOpenConversation(1); await wait()
  assert(document.body.textContent.includes('Onay süresi doldu') && document.body.textContent.includes('Kaydedilmiş işlem'), 'Sohbet yeniden açılınca bitmiş Activity kaydı veya sonucu kayboldu')
  window.api.chat.send = async () => {throw new Error('Deneme gönderim hatası')}
  const freshComposer = document.getElementById('composer-input')
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(freshComposer,'Hata denemesi')
  freshComposer.dispatchEvent(new Event('input',{bubbles:true})); await wait(); key(freshComposer,'Enter'); await wait()
  assert(document.getElementById('shared-state').textContent === 'idle:1:0', 'Erken gönderim hatasında noteReplyFailed durumu temizlemedi')
  return 'Gerçek ChatPage: kaydırma/akış, F0 ortak onayı, ApprovalDock, kalıcı Activity sonucu ve erken gönderim hatası geçti.'
}
window.cleanupChecks = () => reactRoot.unmount()
window.runNavigationChecks = async () => {
  window.api.app = {version:async()=> 'test'}
  flushSync(()=>reactRoot.render(<ToastProvider><div style={{height:650,display:'flex'}}><Sidebar active="chat" onSelect={()=>{}} /><div style={{flex:1,minWidth:0}}><ChatPage active onOpenSettings={()=>{}} /></div></div></ToastProvider>))
  await wait()
  assert(document.querySelector('aside').getBoundingClientRect().width===64,'Dar sidebar 64px olmadı')
  const opener=document.querySelector('[aria-label="Sohbet geçmişini aç"]')
  assert(opener && !document.getElementById('conversation-search'),'Geçmiş dar pencerede kapalı çekmeceye dönüşmedi')
  opener.focus();opener.click();await wait()
  const drawer=document.querySelector('[aria-label="Sohbet geçmişi"]')
  assert(drawer && drawer.getAttribute('aria-modal')==='true','Geçmiş çekmecesi açılmadı')
  key(document.activeElement,'Escape');await wait()
  assert(!document.querySelector('[aria-label="Sohbet geçmişi"]') && document.activeElement===opener,'Çekmece Escape/odak dönüşü bozuldu')
  window.dispatchEvent(new Event('jarvis:open-history'));await wait()
  assert(document.getElementById('conversation-search'),'Palet araması kapalı çekmeceyi açmadı')
  flushSync(()=>reactRoot.render(<CommandPalette currentPage="home" onClose={()=>{}} onNavigate={()=>{}} />));await wait()
  const body=document.body.textContent
  assert(body.includes('Eylemler') && body.includes('Alanlar') && body.includes('Geçmiş'),'Palet grupları eksik')
  assert(!body.includes('Kamera (deneme)') && !body.includes('Başarımlar'),'Eski sayfa kimlikleri kaldı')
  const input=document.querySelector('[aria-label="Komut ara"]')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'bilinmeyen bir isteğim var')
  input.dispatchEvent(new Event('input',{bubbles:true}));await wait()
  assert(document.body.textContent.includes("Bunu Jarvis'e sor"),'Palet eşleşmeyen isteği Jarvis’e yönlendirmedi')
  return 'F5: 64px sidebar, geçmiş çekmecesi/Escape/odak, arama erişimi ve palet grupları/yönlendirme geçti.'
}
window.runHomeChecks = async () => {
  let notes = 0
  const asks = []
  window.api.memories = {list:async()=>[]}
  window.api.system = {personalNote:async()=>{notes++;return 'Bugün sakin bir gün.'},weather:async()=>null}
  window.api.calendar = {events:async()=>[]}
  flushSync(()=>reactRoot.render(<ToastProvider><div style={{height:650}}><HomePage onNavigate={()=>{}} onAsk={text=>asks.push(text)} onOpenConversation={()=>{}} handControlOn={false} onHandControlChange={()=>{}} /></div></ToastProvider>))
  await wait()
  const today = [...document.querySelectorAll('details')].find(item=>item.querySelector('summary').textContent==='Gününü gör')
  assert(today && !today.open && notes===0,'Bugün kapalı başlamadı veya model gereksiz çağrıldı')
  assert(!document.querySelector('canvas'),'Dekoratif arka plan tuvali kaldı')
  today.open = true; await wait(); await wait()
  assert(notes===1 && today.textContent.includes('Bugün sakin bir gün.'),'Gün bağlamı isteğe bağlı açılmadı')
  const input = document.getElementById('home-command')
  assert(input.getAttribute('aria-label'),'Komut kutusunun erişilebilir adı yok')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Bir dosya bul')
  input.dispatchEvent(new Event('input',{bubbles:true})); await wait(); key(input,'Enter'); await wait()
  assert(asks[0]==='Bir dosya bul' && input.value==='','Ana komut gönderimi bozuldu')
  const starters = [...document.querySelectorAll('details')].find(item=>item.querySelector('summary').textContent==='Başlangıç önerileri')
  assert(starters && !starters.open,'Öneriler sürekli görünür kaldı')
  return 'Ana Sayfa: sakin başlangıç, isteğe bağlı gün bağlamı, erişilebilir komut ve katlanmış öneriler geçti.'
}
window.runPageChecks = async () => {
  const today=new Date().toLocaleDateString('sv-SE')
  const tasks=[{id:1,title:'Eski görev',dueDate:'2000-01-01',dueTime:null,doneAt:null},{id:2,title:'Bugünkü görev',dueDate:today,dueTime:'10:00',doneAt:null},{id:3,title:'Gelecek görev',dueDate:'2099-01-01',dueTime:null,doneAt:null},{id:4,title:'Biten görev',dueDate:null,dueTime:null,doneAt:Date.now()}]
  const created=[]
  window.api.tasks={list:async()=>tasks,create:async value=>{created.push(value);return tasks[0]}}
  window.api.automations={list:async()=>[]}
  window.api.google={status:async()=>({connected:false})}
  window.api.analytics={usage:async()=>({totalCalls:4,doneCalls:0,errorCalls:1,deniedCalls:1,timeoutCalls:1,skippedCalls:1,blockedCalls:3,activeDayStreak:0,topTools:[],last14Days:[{date:today,count:0}]}),achievements:async()=>[]}
  const render=element=>flushSync(()=>reactRoot.render(<ToastProvider>{element}</ToastProvider>))
  render(<PlanningPage tab="tasks" onTabChange={()=>{}} />);await wait()
  for(const label of ['Gecikmiş','Bugün','Yaklaşan']) assert(document.querySelector('section[aria-label="'+label+'"]'),'Görev grubu eksik: '+label)
  assert(!document.querySelector('details').open,'Tamamlanan görevler açık başladı')
  const taskInput=document.querySelector('[aria-label="Yeni görev"]')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(taskInput,'Hızlı görev')
  taskInput.dispatchEvent(new Event('input',{bubbles:true}));await wait();taskInput.closest('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await wait()
  assert(created[0].title==='Hızlı görev','Hızlı görev eklenemedi')
  render(<PlanningPage tab="routines" onTabChange={()=>{}} />);await wait()
  const newRoutine=[...document.querySelectorAll('button')].find(button=>button.textContent==='Yeni rutin')
  assert(newRoutine && !document.querySelector('form'),'Rutin formu sürekli görünür')
  newRoutine.click();await wait();assert(document.querySelector('form'),'Yeni rutin formu açılmadı')
  render(<CalendarPage onOpenSettings={()=>{}} />);await wait()
  assert(document.querySelector('[aria-label="Sonraki gün"]') && !document.querySelector('[aria-label="Sonraki ay"]'),'Dar takvim gün akışına geçmedi')
  assert(document.body.textContent.includes('Bugünkü görev'),'Gün akışındaki görev kayboldu')
  window.api.memories={list:async()=>[{id:1,content:'Profil bilgisi',kind:'profil',source:'kullanici',reviewed:true,sourceConversationId:null},{id:2,content:'Tercih bilgisi',kind:'tercih',source:'otomatik',reviewed:false,sourceConversationId:3}],update:async()=>{throw new Error('Test kaydetme hatası')}}
  render(<div style={{height:650}}><MemoriesView onOpenConversation={()=>{}} /></div>);await wait()
  assert(document.body.textContent.includes('Profil · 1') && document.body.textContent.includes('Tercih · 1') && document.body.textContent.includes('Sohbet #3'),'Hafıza grupları veya kaynak eksik')
  const edit=document.querySelector('[aria-label="Bilgiyi düzenle"]');edit.click();await wait()
  const memoryInput=document.querySelector('[aria-label="Hafıza kaydını düzenle"]')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(memoryInput,'Düzeltilen bilgi');memoryInput.dispatchEvent(new Event('input',{bubbles:true}));await wait()
  ;[...document.querySelectorAll('button')].find(button=>button.textContent==='Kaydet').click();await wait()
  assert(document.querySelector('[aria-label="Hafıza kaydını düzenle"]').value==='Düzeltilen bilgi','Kaydetme hatası düzeltme metnini kaybettirdi')
  render(<AnalyticsPage />);await wait()
  for(const label of ['Teknik hata','Kullanıcı reddi','Onay süresi doldu','İzin nedeniyle atlanan']) assert(document.body.textContent.includes(label),'Analiz ayrımı eksik: '+label)
  const zero=document.querySelector('[title$=": 0 çağrı"]');assert(zero && zero.style.height==='0%','Sıfır gün sahte yükseklikle gösterildi')
  let backupLoads=0
  window.api.settings.get=async()=>({provider:'ollama',hasSecret:{},models:{ollama:'test'},briefCity:'',briefTime:'08:00',globalShortcut:'Control+Shift+J',quietStart:'22:00',quietEnd:'08:00'})
  window.api.backups={list:async()=>{backupLoads++;return []}}
  render(<SettingsPage />);await wait()
  assert(document.querySelector('[role="tab"][aria-selected="true"]').textContent==='Temel tercihler','Ayarlar temel tercihlerle açılmadı')
  const advanced=[...document.querySelectorAll('details')].find(item=>item.querySelector('summary').textContent.includes('İleri ayarlar'))
  assert(advanced && !advanced.open && backupLoads===0,'İleri ayarlar kapalı başlamadı veya gereksiz yedek sorgusu yaptı')
  return 'F8: görev grupları/hızlı ekleme, kapalı rutin formu, dar takvim, hafıza kaynakları/düzeltme, ayrık analiz/sıfır gün ve temel ayarlar geçti.'
}
window.runWideCalendarChecks = async () => {
  flushSync(()=>reactRoot.render(<ToastProvider><CalendarPage onOpenSettings={()=>{}} /></ToastProvider>));await wait()
  assert(document.querySelector('[aria-label="Sonraki ay"]') && !document.querySelector('[aria-label="Sonraki gün"]'),'Geniş takvim aya dönmedi')
  assert(document.querySelectorAll('button[aria-pressed]').length>=28,'Geniş ay ızgarası kayboldu')
  return 'Takvim: geniş pencerede ay + gün akışı geçti.'
}
window.runActivityChecks = async () => {
  const tools = Array.from({length:6}, (_,index) => ({id:'step-'+index,name:'arac_'+index,label:'İş adımı '+index,status:index===5?'running':'done',input:{aranan:'örnek belge'},result:index===5?undefined:'Örnek sonuç'}))
  let stops = 0
  const renderSurface = props => flushSync(() => reactRoot.render(<ActivitySurface {...props} />))
  renderSurface({tools,pending:true,onStop:async () => {stops++}}); await wait()
  const region = document.querySelector('[aria-label="Jarvis etkinliği"]')
  assert(region, 'Activity Surface bulunamadı')
  const toggle = region.querySelector('[aria-expanded]')
  const content = document.getElementById(toggle.getAttribute('aria-controls'))
  assert(toggle.getAttribute('aria-expanded')==='true','Aktif işlem adımları açık başlamadı')
  assert(content.querySelector(':scope > ol').children.length===3,'Normal görünüm üç adımla sınırlanmadı')
  assert(content.querySelector('details summary').textContent==='Önceki 3 adım','Önceki adımlar katlanmadı')
  assert(!content.querySelector('details').open,'Önceki adımlar açık başladı')
  assert(!region.textContent.includes('%'),'Bilinmeyen ilerlemeye yüzde üretildi')
  const technical = [...region.querySelectorAll('button')].find(button=>button.textContent==='Teknik ayrıntılar')
  technical.click(); await wait()
  assert(region.textContent.includes('Araç: arac_5') && region.textContent.includes('örnek belge'),'Teknik girdi açılmadı')
  toggle.click(); await wait()
  assert(content.hidden,'Kapalı özet seviyesi çalışmadı')
  renderSurface({tools,pending:true,approval:{id:'activity-approval',toolName:'test',label:'Yüzey onayı',summary:'Bekleyen işlem'},onRespond:()=>{},onStop:async()=>{stops++}}); await wait()
  assert(region.textContent.includes('Yüzey onayı') && !region.querySelector('button').closest('[hidden]'),'Onay kapalı özette gizlendi')
  const stop = region.querySelector('[aria-label="Jarvis işlemini durdur"]')
  stop.click(); await wait(); stop.click(); await wait()
  assert(stops===1 && stop.disabled && stop.textContent==='Durduruluyor','Durdur tekrarlı çağrıya veya belirsiz duruma yol açtı')
  reactRoot.render(null); await wait()
  renderSurface({tools:tools.map(tool=>({...tool,status:'done'})),outcome:'stopped'}); await wait()
  const finished = document.querySelector('[aria-label="Jarvis etkinliği"]')
  assert(finished.textContent.includes('Durduruldu'),'F0 sonuç türü gösterilmedi')
  assert(finished.querySelector('[aria-expanded]').getAttribute('aria-expanded')==='false','Bitmiş işlem kapalı başlamadı')
  finished.querySelector('[aria-expanded]').click(); await wait()
  renderSurface({tools:[{...tools[0],status:'done',card:{kind:'task',title:'Kartlı görev',due:null}}],outcome:'completed'}); await wait()
  assert(document.body.textContent.includes('Kartlı görev'),'F7 ResultCard gösterilmedi')
  renderSurface({tools:[{...tools[0],status:'running',card:{kind:'task',title:'Henüz bitmedi',due:null}}],pending:true}); await wait()
  assert(!document.body.textContent.includes('Henüz bitmedi'),'Bitmeyen araç sonuç kartı gösterdi')
  return 'Activity Surface: F7 sonuç kartı, üç seviye, son üç adım, teknik ayrıntı, görünür onay, tek durdurma ve F0 sonucu geçti.'
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
            builder.onResolve({ filter: /\?.*url$/ }, () => ({
              path: 'asset-url',
              namespace: 'test-url'
            }))
            builder.onLoad({ filter: /.*/, namespace: 'test-url' }, () => ({
              contents: "export default ''",
              loader: 'js'
            }))
            builder.onResolve({ filter: /lib\/useHandTracking$/ }, () => ({
              path: 'hands',
              namespace: 'test-hands'
            }))
            builder.onLoad({ filter: /.*/, namespace: 'test-hands' }, () => ({
              contents:
                "import {useRef} from 'react';export function useHandTracking(){return {videoRef:useRef(null),status:'off',pinching:false,handPoint:null,twoHandSpread:null,handNormalized:null}}",
              loader: 'js',
              resolveDir: root
            }))
            builder.onResolve({ filter: /lib\/useClapActivation$/ }, () => ({
              path: 'clap',
              namespace: 'test-clap'
            }))
            builder.onLoad({ filter: /.*/, namespace: 'test-clap' }, () => ({
              contents:
                'export function useClapActivation(){};export async function hasCamera(){return false}',
              loader: 'js'
            }))
            // Küre Claude'un alanı; bu test yalnızca sohbet yerleşimini ve ortak UI'ı ölçer.
            builder.onResolve({ filter: /jarvis\/Orb$/ }, () => ({
              path: 'orb',
              namespace: 'test-orb'
            }))
            builder.onLoad({ filter: /.*/, namespace: 'test-orb' }, () => ({
              contents:
                'export default function Orb({size}){return <div style={{width:size,height:size}} aria-hidden="true" />} ',
              loader: 'jsx',
              resolveDir: root
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
    const rendererPath = join(process.env.JARVIS_UI_ASSETS_ROOT ?? root, 'out', 'renderer')
    const html = await readFile(join(rendererPath, 'index.html'), 'utf8')
    const css = html.match(/href="([^"?#]+\.css)"/)?.[1]
    if (!css) throw new Error('Önce electron-vite build çalıştırılmalı.')
    const styles = await readFile(resolve(rendererPath, css), 'utf8')
    // file: kökeni localStorage kullanabilir; yalnızca geçici profil içindeki mock belge açılır.
    const fixturePath = join(profile, 'ui-fixture.html')
    await writeFile(fixturePath, '<div id="root"></div>', 'utf8')
    await window.loadFile(fixturePath)
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
    for (const check of ['runChatChecks', 'runActivityChecks', 'runHomeChecks']) {
      const result = await window.webContents.executeJavaScript(
        `window.${check}().catch(error => ({ error: error.message, stack: error.stack }))`
      )
      if (result.error) throw new Error(result.stack ?? result.error)
      console.log(result)
    }
    window.setSize(1000, 860)
    await window.webContents.executeJavaScript('new Promise(resolve => setTimeout(resolve, 150))')
    const navigation = await window.webContents.executeJavaScript(
      'window.runNavigationChecks().catch(error => ({error:error.message,stack:error.stack}))'
    )
    if (navigation.error) throw new Error(navigation.stack ?? navigation.error)
    console.log(navigation)
    const pages = await window.webContents.executeJavaScript(
      'window.runPageChecks().catch(error => ({error:error.message,stack:error.stack}))'
    )
    if (pages.error) throw new Error(pages.stack ?? pages.error)
    console.log(pages)
    window.setSize(1360, 860)
    await window.webContents.executeJavaScript('new Promise(resolve => setTimeout(resolve, 150))')
    const wide = await window.webContents.executeJavaScript(
      'window.runWideCalendarChecks().catch(error => ({error:error.message,stack:error.stack}))'
    )
    if (wide.error) throw new Error(wide.stack ?? wide.error)
    console.log(wide)
    await window.webContents.executeJavaScript('window.cleanupChecks()')
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
