import 'highlight.js/styles/github-dark-dimmed.css'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ToastProvider from './components/ui/ToastProvider'

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
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>
)
