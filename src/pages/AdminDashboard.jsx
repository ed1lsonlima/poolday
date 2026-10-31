import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { resolveAdminTab } from '../lib/adminInbox'
import AdminMFA from '../components/common/AdminMFA'
import AdminPanel from '../components/admin/AdminPanel'

async function adminFetch(query = '', body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sua sessão expirou. Entre novamente.')
  const response = await fetch(`/api/admin${query}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${session.access_token}`, ...(body && { 'Content-Type': 'application/json' }) },
    ...(body && { body: JSON.stringify(body) }),
  })
  const result = await response.json()
  if (!response.ok) { const error = new Error(result.error); error.code = result.code; throw error }
  return result
}

const SUCCESS = {
  approve_property: 'Espaço aprovado e publicado. O anfitrião foi avisado.',
  marcar_indicacao_paga: 'Indicação marcada como paga e registrada na auditoria.',
}

export default function AdminDashboard() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [mfa, setMfa] = useState(false)
  const [acting, setActing] = useState(false)
  const tab = resolveAdminTab(params.get('tab'))

  const load = useCallback(async () => {
    setBusy(true); setError('')
    try { setData(await adminFetch()); setMfa(false) }
    catch (e) { if (e.code === 'MFA_REQUIRED') { setData(null); setMfa(true) } else setError(e.message || 'Não foi possível carregar o painel.') }
    finally { setBusy(false) }
  }, [])
  useEffect(() => { load() }, [load])

  function failed(e) {
    toast.error(e.message)
    if (e.code === 'MFA_REQUIRED') { setData(null); setMfa(true) }
  }
  // Toda alteração passa por /api/admin, que confere MFA e grava a auditoria.
  async function act(body, { quiet = false, skipReload = false } = {}) {
    setActing(true)
    try {
      await adminFetch('', body)
      if (!quiet) toast.success(SUCCESS[body.action] || 'Alteração concluída e registrada na auditoria.')
      if (!skipReload) await load()
      return true
    } catch (e) { failed(e); return false }
    finally { setActing(false) }
  }
  async function detail(query) {
    try { return await adminFetch(query) }
    catch (e) { failed(e); return null }
  }

  // Abrir uma conversa fica registrado na auditoria; recarregar tira a conversa de "Precisa de você agora".
  if (mfa) return <div className="min-h-[80vh] bg-gray-50 px-4 py-4"><AdminMFA onVerified={load}/></div>
  if (!data) return <div className="max-w-xl mx-auto text-center px-4 py-24"><ShieldCheck size={38} className="mx-auto text-primary-500 mb-4"/><h1 className="text-2xl font-bold">Administração PoolDay</h1><p role="status" className="text-gray-500 mt-4">{busy ? 'Verificando acesso seguro...' : error}</p>{!busy && <button className="btn-primary mt-5" onClick={load}>Tentar novamente</button>}</div>

  return <AdminPanel data={data} tab={tab} onTab={id => setParams(id === 'overview' ? {} : { tab: id }, { replace: true })}
    busy={busy} error={error} onReload={load} acting={acting} onAction={act}
    onApprove={property => act({ action: 'approve_property', id: property.id })}
    onOpenProperty={async id => (await detail(`?action=property-detail&propertyId=${encodeURIComponent(id)}`))?.property || null}
    onOpenChat={async id => { const result = await detail(`?action=chat-detail&bookingId=${encodeURIComponent(id)}`); if (result) load(); return result }}/>
}
