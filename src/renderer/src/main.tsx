import 'highlight.js/styles/github-dark-dimmed.css'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import HudApp from './HudApp'
import NotchApp from './NotchApp'
import ToastProvider from './components/ui/ToastProvider'

// Ayrı bir electron-vite giriş noktası açmadan, aynı bundle #hud ile HUD penceresini render eder
const isHud = window.location.hash === '#hud'
const isNotch = window.location.hash === '#notch'
// Çentik de HUD gibi saydam zeminli yardımcı pencere
if (isHud || isNotch) document.body.classList.add('hud-mode')

// Arayüzde yakalanmayan hatalar günlük dosyasına yazılsın (sorun ayıklarken gerekli)
window.addEventListener('error', (event) => {
  const stack = event.error instanceof Error ? `\n${event.error.stack ?? ''}` : ''
  window.api.app.logError(`${event.message} (${event.filename}:${event.lineno})${stack}`)
})
window.addEventListener('unhandledrejection', (event) => {
  const reason =
    event.reason instanceof Error
      ? (event.reason.stack ?? event.reason.message)
      : String(event.reason)
  window.api.app.logError(`İşlenmeyen hata: ${reason}`)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isHud ? (
      <HudApp />
    ) : isNotch ? (
      <NotchApp />
    ) : (
      <ToastProvider>
        <App />
      </ToastProvider>
    )}
  </StrictMode>
)
