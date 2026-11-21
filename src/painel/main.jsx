import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import '../index.css'
import PainelApp from './PainelApp'

createRoot(document.getElementById('painel')).render(
  <StrictMode>
    <Toaster position="top-center" toastOptions={{ duration: 3000, style: { borderRadius: '12px', fontFamily: 'Inter, sans-serif' } }} />
    <PainelApp />
  </StrictMode>,
)
