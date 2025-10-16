import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

let deferredPrompt = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e
  const btn = document.getElementById('install-btn')
  if (btn) btn.style.display = 'flex'
})
window.fo_install = async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    deferredPrompt = null
    const btn = document.getElementById('install-btn')
    if (btn) btn.style.display = 'none'
  }
}

createRoot(document.getElementById('root')).render(<App />)
