import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, Waves } from 'lucide-react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    setLoading(false)
    if (error) return toast.error('Não foi possível enviar o link. Confira o e-mail e tente novamente.')
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 mb-6"><ArrowLeft size={16}/> Início</Link>
        <div className="flex items-center justify-center gap-2 mb-4"><Waves className="text-primary-500" size={28}/><span className="font-bold text-xl">PoolDay</span></div>
        <h1 className="text-2xl font-bold text-gray-800 text-center">Recuperar senha</h1>
        <p className="text-gray-500 text-sm text-center mt-2 mb-6">Enviaremos um link seguro para você cadastrar uma nova senha.</p>
        {sent ? (
          <div className="bg-green-50 text-green-800 rounded-2xl p-4 text-sm text-center">Se este e-mail estiver cadastrado, o link chegará em instantes. Verifique também a pasta de spam.</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label htmlFor="recovery-email" className="text-sm font-medium text-gray-700 block">E-mail</label>
            <div className="relative"><Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/><input id="recovery-email" className="input-field pl-11" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <button className="btn-primary w-full" disabled={loading}>{loading ? 'Enviando...' : 'Enviar link'}</button>
          </form>
        )}
        <Link to="/entrar" className="block text-center text-sm text-primary-600 font-semibold mt-6 hover:underline">Voltar para entrar</Link>
      </div>
    </div>
  )
}
