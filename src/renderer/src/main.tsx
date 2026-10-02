import 'highlight.js/styles/github-dark-dimmed.css'
import '@fontsource-variable/inter/wght.css'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import App from './App'
import NotchApp from './NotchApp'
import CompanionApp from './CompanionApp'
import ToastProvider from './components/ui/ToastProvider'

// Ayrı bir electron-vite giriş noktası açmadan, aynı bundle #notch ile çentik penceresini render eder
const isNotch = window.location.hash === '#notch'
// Masaüstü arkadaş (görev çubuğunun üstündeki robot) da aynı bundle'dan #companion ile açılır
const isCompanion = window.location.hash === '#companion'
// Çentik saydam zeminli yardımcı pencere
if (isNotch || isCompanion) document.body.classList.add('hud-mode')

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
    <MotionConfig reducedMotion="user">
      {isNotch ? (
        <NotchApp />
      ) : isCompanion ? (
        <CompanionApp />
      ) : (
        <ToastProvider>
          <App />
        </ToastProvider>
      )}
    </MotionConfig>
  </StrictMode>
)
