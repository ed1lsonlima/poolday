import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { buildVisit } from '../../lib/visitTracking'

// Registra cada página aberta. Falhas são ignoradas: a contagem nunca atrapalha quem está navegando.
export default function VisitTracker() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (import.meta.env.DEV) return
    let visit = null
    try { visit = buildVisit({ path: pathname, storage: window.localStorage }) } catch { return }
    if (!visit) return
    supabase.rpc('registrar_visita', { p_visit: visit }).then(() => {}, () => {})
  }, [pathname])
  return null
}
