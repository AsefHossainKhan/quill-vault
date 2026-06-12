import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Expose IPC renderer for Electron communication
// window.electronAPI is available in Electron builds
// In browser dev mode it won't exist, so we guard with optional chaining
