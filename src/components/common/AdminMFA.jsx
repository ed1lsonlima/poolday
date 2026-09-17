import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function AdminMFA({ onVerified }) {
  const [factor, setFactor] = useState(null)
  const [enrollment, setEnrollment] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (!alive) return
      if (error) setError('Não foi possível consultar a proteção da conta.')
      else setFactor(data.totp.find(f => f.status === 'verified') || null)
      setBusy(false)
    })
    return () => { alive = false }
  }, [])
  async function enroll() {
    setBusy(true); setError('')
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) throw listError
      // Only discard unfinished setup factors for this dashboard, never a verified factor.
      for (const f of factors.all.filter(f => f.status === 'unverified' && f.friendly_name === 'PoolDay Administração')) await supabase.auth.mfa.unenroll({ factorId: f.id })
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'PoolDay Administração', issuer: 'PoolDay' })
      if (error) throw error
      setFactor(data); setEnrollment(data.totp)
    } catch { setError('Não foi possível iniciar a configuração. Tente novamente.') } finally { setBusy(false) }
  }
  async function verify(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
      if (error) throw error
      setEnrollment(null); setCode(''); onVerified()
    } catch { setError('Código inválido ou expirado. Digite o código atual do aplicativo.') } finally { setBusy(false) }
  }
  return <section className="max-w-md mx-auto my-12 bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
    <ShieldCheck className="text-primary-500 mb-4" size={36}/><h1 className="font-bold text-2xl">Proteja sua administração</h1><p className="text-gray-500 text-sm mt-3 mb-5">Para acessar dados de clientes e pagamentos, confirme a segunda etapa de segurança com um aplicativo autenticador.</p>
    {enrollment && <div className="space-y-3 mb-4"><p className="text-sm">Escaneie o QR no Google Authenticator, Microsoft Authenticator ou outro aplicativo compatível.</p><img className="w-48 h-48 mx-auto" alt="QR para configurar o autenticador" src={enrollment.qr_code.startsWith('data:') ? enrollment.qr_code : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr_code)}`} /><details className="text-xs"><summary>Configurar manualmente neste celular</summary><p className="break-all select-all bg-gray-50 p-3 mt-2">{enrollment.secret}</p></details><p className="text-xs text-amber-700">Guarde o acesso ao autenticador. Não compartilhe esta chave. Ao ativar, outras sessões da conta serão encerradas.</p></div>}
    {factor ? <form onSubmit={verify}><label htmlFor="admin-otp" className="text-sm font-semibold">Código de 6 dígitos</label><input id="admin-otp" className="input-field mt-2 tracking-[.3em] text-center" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} required/><button className="btn-primary w-full mt-4" disabled={busy || code.length !== 6}>{busy ? 'Verificando...' : 'Acessar painel'}</button></form> : <button className="btn-primary w-full" disabled={busy} onClick={enroll}>{busy ? 'Carregando...' : 'Configurar autenticador'}</button>}
    {error && <p role="alert" className="text-red-600 text-sm mt-4">{error}</p>}
  </section>
}
