import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { getAnalyticsInstance } from './firebase'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

registerSW({
  immediate: true,
  onOfflineReady() {
    console.info('OnlyEXIF offline cache ready.')
  }
})

// Initialise Firebase Analytics lazily (non-blocking)
void getAnalyticsInstance()
