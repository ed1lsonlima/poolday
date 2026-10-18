import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function BackButton({ className = '', compact = false }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  if (pathname === '/') return null
  function goBack() {
    if (Number(window.history.state?.idx) > 0) navigate(-1)
    else navigate('/', { replace: true })
  }
  return <button type="button" onClick={goBack} aria-label="Voltar à tela anterior" className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors ${className}`}><ArrowLeft size={15}/><span className={compact ? 'hidden sm:inline' : ''}>Voltar</span></button>
}

