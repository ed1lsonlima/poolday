import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Sem isso, navegar entre páginas mantém o scroll no meio da tela.
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
