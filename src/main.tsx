// Theme boot: detects the persisted theme before React mounts so the page does not flash
// the wrong color palette during startup.
;(function () {
  try {
    const stored = localStorage.getItem('kl-theme')
    const theme = stored === 'light' ? 'light' : 'dark'
    document.documentElement.classList.remove('dark')
    if (theme === 'dark') document.documentElement.classList.add('dark')
  } catch (_) {}
})()

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Mounts the portfolio shell into the root element after the theme is applied.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
