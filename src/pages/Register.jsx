import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Waves, Mail, Lock, User, Phone, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Register() {
  const [params] = useSearchParams()
  const [role, setRole] = useState(params.get('role') || 'client')
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password !== form.confirm) return toast.error('As senhas não coincidem!')
    if (form.password.length < 8) return toast.error('Senha deve ter pelo menos 8 caracteres!')
    if (role === 'host' && !form.phone.trim()) return toast.error('Como anfitrião, informe um telefone/WhatsApp — é por ele que os clientes vão falar com você.')
    setLoading(true)
    try {
      const result = await signUp({ ...form, role })
      if (result?.session) {
        toast.success('Conta criada com sucesso!')
      } else {
        toast.success('Conta criada! Confirme pelo link enviado ao seu email.')
      }
      navigate(role === 'host' ? '/anfitriao/boas-vindas' : '/')
    } catch (err) {
      toast.error(err.message || 'Erro ao criar conta')
    } finally { setLoading(false) }
  }

  async function handleGoogle() {
    try { await signInWithGoogle() }
    catch (err) { toast.error('Erro ao entrar com Google') }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 mb-4"><ArrowLeft size={16}/> Início</Link>
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Waves className="text-primary-500" size={28} />
            <span className="font-bold text-xl text-gray-800">PoolDay</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Criar conta</h1>
          <p className="text-gray-500 text-sm mt-1">Cadastre-se para começar</p>
        </div>

        <button onClick={handleGoogle} className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 mb-6 hover:bg-gray-50 transition-colors">
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          <span className="font-medium text-gray-700">Continuar com Google</span>
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-400 text-sm">ou</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="flex rounded-xl border border-gray-200 p-1 mb-6">
          <button type="button" aria-pressed={role === 'client'} onClick={() => setRole('client')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${role === 'client' ? 'bg-primary-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            Cliente
          </button>
          <button type="button" aria-pressed={role === 'host'} onClick={() => setRole('host')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${role === 'host' ? 'bg-primary-500 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            Anfitrião
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label htmlFor="register-name" className="sr-only">Nome completo</label>
            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="register-name" className="input-field pl-11" autoComplete="name" placeholder="Nome completo" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          </div>
          <div className="relative">
            <label htmlFor="register-email" className="sr-only">E-mail</label>
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="register-email" className="input-field pl-11" type="email" autoComplete="email" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          </div>
          <div className="relative">
            <label htmlFor="register-phone" className="sr-only">WhatsApp</label>
            <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="register-phone" className="input-field pl-11" type="tel" autoComplete="tel" placeholder={role === 'host' ? 'WhatsApp (obrigatório)' : 'Telefone (opcional)'} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required={role === 'host'} />
          </div>
          <div className="relative">
            <label htmlFor="register-password" className="sr-only">Senha</label>
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="register-password" className="input-field pl-11 pr-11" type={showPass ? 'text' : 'password'} autoComplete="new-password" placeholder="Senha (mínimo 8 caracteres)" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
            <button type="button" aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
              {showPass ? <EyeOff size={18}/> : <Eye size={18}/>}
            </button>
          </div>
          <div className="relative">
            <label htmlFor="register-confirm" className="sr-only">Confirmar senha</label>
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="register-confirm" className="input-field pl-11" type={showPass ? 'text' : 'password'} autoComplete="new-password" placeholder="Confirmar senha" value={form.confirm} onChange={e => setForm({...form, confirm: e.target.value})} required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Já tem conta?{' '}
          <Link to="/entrar" className="text-primary-500 font-semibold hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  )
}

