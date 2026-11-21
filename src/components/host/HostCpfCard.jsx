import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { IdCard } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cpfValido, formatCpf } from '../../lib/referralProgram'

// Anfitrião que entrou pelo Google não passou pelo campo de CPF do cadastro: pedimos aqui, uma vez.
export default function HostCpfCard({ userId }) {
  const [falta, setFalta] = useState(false)
  const [cpf, setCpf] = useState('')
  const [salvando, setSalvando] = useState(false)
  useEffect(() => {
    if (!userId) return
    supabase.from('documentos_anfitriao').select('user_id').eq('user_id', userId).maybeSingle().then(({ data, error }) => setFalta(!error && !data))
  }, [userId])
  if (!falta) return null
  async function salvar(event) {
    event.preventDefault()
    if (!cpfValido(cpf)) return toast.error('Confira o CPF.')
    setSalvando(true)
    const { data, error } = await supabase.rpc('salvar_cpf_anfitriao', { p_cpf: cpf })
    setSalvando(false)
    if (error || !['SALVO', 'JA_INFORMADO'].includes(data)) return toast.error('Não foi possível salvar o CPF.')
    setFalta(false); toast.success('CPF salvo.')
  }
  return <form onSubmit={salvar} className="rounded-2xl border border-primary-100 bg-primary-50 p-4 mb-6">
    <p className="font-bold text-gray-900 flex items-center gap-2"><IdCard size={18} className="text-primary-500"/>Informe seu CPF</p>
    <p className="text-sm text-gray-600 mt-1">Usamos o CPF só para confirmar sua identidade na verificação do espaço. Ele não aparece para clientes.</p>
    <div className="flex flex-col sm:flex-row gap-2 mt-3"><input className="input-field flex-1" inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} aria-label="CPF"/><button className="btn-primary py-3 px-5" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar CPF'}</button></div>
  </form>
}
