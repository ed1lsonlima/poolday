import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { User, Mail, Phone, MapPin, LogOut, ShieldCheck, FileText, LayoutDashboard } from 'lucide-react'
import toast from 'react-hot-toast'

function Field({ label, icon, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1.5">{icon} {label}</label>
      <input className="input-field" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

export default function Configuracoes() {
  const { user, profile, updateProfile, signOut } = useAuth()
  const [form, setForm] = useState({ name: '', phone: '', city: '' })
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (profile) setForm({ name: profile.name || '', phone: profile.phone || '', city: profile.city || '' })
  }, [profile])

  async function handleSave() {
    setSaving(true)
    try {
      await updateProfile(form)
      toast.success('Dados atualizados!')
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Configurações</h1>
        <p className="text-gray-500 text-sm mb-6">Gerencie seus dados e sua conta.</p>

        {/* Dados pessoais */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
          <h2 className="font-bold text-gray-800 mb-4">Dados pessoais</h2>
          <div className="space-y-4">
            <Field label="Nome" icon={<User size={15}/>} value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Seu nome" />
            <Field label="Telefone" icon={<Phone size={15}/>} value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="(82) 99999-9999" />
            <Field label="Cidade" icon={<MapPin size={15}/>} value={form.city} onChange={v => setForm({ ...form, city: v })} placeholder="Sua cidade" />
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1.5"><Mail size={15}/> Email</label>
              <p className="text-gray-500 py-2 border-b border-gray-100">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full mt-5">{saving ? 'Salvando...' : 'Salvar alterações'}</button>
        </section>

        {/* Conta */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
          <h2 className="font-bold text-gray-800 mb-3">Conta</h2>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600">Tipo de conta</span>
            <span className="text-xs font-semibold bg-primary-100 text-primary-600 px-2.5 py-1 rounded-full capitalize">{profile?.role === 'host' ? 'Anfitrião' : 'Cliente'}</span>
          </div>
          <Link to="/perfil" className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-500 py-3 transition-colors"><User size={15}/> Ver meu perfil</Link>
          {profile?.role === 'host' && (
            <Link to="/anfitriao" className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-500 py-1 transition-colors"><LayoutDashboard size={15}/> Painel do Anfitrião</Link>
          )}
        </section>

        {/* Sobre / legal */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
          <h2 className="font-bold text-gray-800 mb-3">Sobre</h2>
          <div className="flex flex-col">
            <Link to="/termos" className="text-sm text-gray-600 hover:text-primary-500 py-2 flex items-center gap-2 transition-colors"><FileText size={15}/> Termos de uso</Link>
            <Link to="/privacidade" className="text-sm text-gray-600 hover:text-primary-500 py-2 flex items-center gap-2 transition-colors"><ShieldCheck size={15}/> Política de privacidade</Link>
          </div>
        </section>

        <button onClick={handleSignOut} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-red-200 text-red-500 font-semibold hover:bg-red-50 transition-colors">
          <LogOut size={16}/> Sair da conta
        </button>
      </div>
    </div>
  )
}
