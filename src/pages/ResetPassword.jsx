import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, Waves } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) return toast.error('Use pelo menos 8 caracteres.')
    if (password !== confirm) return toast.error('As senhas não coincidem.')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return toast.error('O link expirou ou não é válido. Solicite um novo link.')
    toast.success('Senha atualizada!')
    navigate('/entrar')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 mb-6"><ArrowLeft size={16}/> Início</Link>
        <div className="flex items-center justify-center gap-2 mb-4"><Waves className="text-primary-500" size={28}/><span className="font-bold text-xl">PoolDay</span></div>
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-6">Criar nova senha</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label htmlFor="new-password" className="text-sm font-medium text-gray-700 block">Nova senha</label>
          <div className="relative"><Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/><input id="new-password" className="input-field pl-11" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <label htmlFor="confirm-password" className="text-sm font-medium text-gray-700 block">Confirmar nova senha</label>
          <input id="confirm-password" className="input-field" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          <button className="btn-primary w-full" disabled={loading}>{loading ? 'Salvando...' : 'Salvar nova senha'}</button>
        </form>
      </div>
    </div>
  )
}
