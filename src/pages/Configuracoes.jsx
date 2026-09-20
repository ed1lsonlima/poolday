import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BellRing, ChevronRight, FileText, LayoutDashboard, LockKeyhole, LogOut, Mail, Phone, Save, ShieldCheck, User } from 'lucide-react'
import toast from 'react-hot-toast'
import CityField from '../components/common/CityField'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const DEFAULT_PREFERENCES = { in_app_bookings: true }

function Field({ label, icon, value, onChange, placeholder, autoComplete }) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 flex items-center gap-1.5">{icon} {label}</label>
      <input className="input-field" value={value} placeholder={placeholder} autoComplete={autoComplete} onChange={event => onChange(event.target.value)} />
    </div>
  )
}

export default function Configuracoes() {
  const { user, profile, updateProfile, signOut, isAdmin } = useAuth()
  const [form, setForm] = useState({ name: '', phone: '', city: '', state: null, municipality_code: null })
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  const [saving, setSaving] = useState(false)
  const [sendingPassword, setSendingPassword] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!profile) return
    setForm({
      name: profile.name || '',
      phone: profile.phone || '',
      city: profile.city || '',
      state: profile.state || null,
      municipality_code: profile.municipality_code || null,
    })
    setPreferences({ ...DEFAULT_PREFERENCES, ...profile.notification_preferences })
  }, [profile])

  async function handleSave() {
    setSaving(true)
    try {
      await updateProfile({ ...form, notification_preferences: preferences })
      toast.success('Configurações salvas!')
    } catch {
      toast.error('Não foi possível salvar agora.')
    } finally {
      setSaving(false)
    }
  }

  async function sendPasswordReset() {
    if (!user?.email) return
    setSendingPassword(true)
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/redefinir-senha` })
    setSendingPassword(false)
    if (error) toast.error('Não foi possível enviar o link.')
    else toast.success('Link de redefinição enviado para seu e-mail.')
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-500 mb-2">Sua conta</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Configurações</h1>
          <p className="text-gray-500 text-sm mt-1">Atualize seus dados, avisos e segurança em um só lugar.</p>
        </div>

        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 sm:p-7 mb-5">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-11 h-11 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center"><User size={20} /></span>
            <div><h2 className="font-extrabold text-gray-900">Perfil e contato</h2><p className="text-xs text-gray-400">Informações usadas em reservas e atendimento</p></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nome" icon={<User size={15} />} value={form.name} onChange={name => setForm(previous => ({ ...previous, name }))} placeholder="Seu nome" autoComplete="name" />
            <Field label="WhatsApp" icon={<Phone size={15} />} value={form.phone} onChange={phone => setForm(previous => ({ ...previous, phone }))} placeholder="(82) 99999-9999" autoComplete="tel" />
            <div className="sm:col-span-2"><CityField value={form} onChange={location => setForm(previous => ({ ...previous, ...location }))} /></div>
            <div className="sm:col-span-2 rounded-xl bg-gray-50 px-4 py-3 flex items-center gap-3 min-w-0">
              <Mail size={17} className="text-gray-400 shrink-0" /><div className="min-w-0"><p className="text-[11px] font-bold uppercase text-gray-400">E-mail da conta</p><p className="text-sm text-gray-700 truncate">{user?.email}</p></div><span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Verificado</span>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 sm:p-7 mb-5">
            <div className="flex items-center gap-3 mb-5">
              <span className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center"><BellRing size={20} /></span>
              <div><h2 className="font-extrabold text-gray-900">Notificações</h2><p className="text-xs text-gray-400">Acompanhe pagamentos, prazos e cancelamentos</p></div>
            </div>
            <PreferenceToggle
              checked={preferences.in_app_bookings !== false}
              onChange={checked => setPreferences(previous => ({ ...previous, in_app_bookings: checked }))}
              title="Avisos importantes no sininho"
              description="Mostra pagamentos, vencimentos, confirmações e cancelamentos no topo do site."
            />
            <p className="text-xs text-gray-400 mt-3 leading-relaxed">Avisos essenciais de pagamento, segurança e mudanças na conta continuam disponíveis nas telas correspondentes.</p>
        </section>

        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 sm:p-7 mb-5">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><LockKeyhole size={20} /></span>
            <div><h2 className="font-extrabold text-gray-900">Segurança</h2><p className="text-xs text-gray-400">Proteja o acesso à sua conta</p></div>
          </div>
          <button type="button" onClick={sendPasswordReset} disabled={sendingPassword} className="w-full flex items-center gap-3 rounded-xl border border-gray-200 p-4 text-left hover:border-primary-200 hover:bg-primary-50/40 transition-colors disabled:opacity-60">
            <Mail size={18} className="text-primary-500 shrink-0" />
            <span className="flex-1"><b className="block text-sm text-gray-800">Alterar minha senha</b><span className="text-xs text-gray-500">Receba um link seguro em {user?.email}</span></span>
            <ChevronRight size={18} className="text-gray-300" />
          </button>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700"><ShieldCheck size={16} className="shrink-0" /> Nunca compartilhe sua senha ou códigos de acesso com outras pessoas.</div>
        </section>

        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 sm:p-7 mb-5">
          <h2 className="font-extrabold text-gray-900 mb-3">Conta e acesso</h2>
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <span className="text-sm text-gray-600">Tipo de conta</span>
            <span className="text-xs font-bold bg-primary-100 text-primary-600 px-2.5 py-1 rounded-full">{profile?.role === 'host' ? 'Anfitrião' : 'Cliente'}</span>
          </div>
          <SettingsLink to="/perfil" icon={<User size={16} />} label="Ver meu perfil" />
          {profile?.role === 'host' && <SettingsLink to="/anfitriao" icon={<LayoutDashboard size={16} />} label="Abrir painel do anfitrião" />}
          {isAdmin && <SettingsLink to="/admin" icon={<LayoutDashboard size={16} />} label="Abrir administração PoolDay" />}
        </section>

        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 sm:p-7 mb-6">
          <h2 className="font-extrabold text-gray-900 mb-3">Privacidade e documentos</h2>
          <SettingsLink to="/termos" icon={<FileText size={16} />} label="Termos de uso" />
          <SettingsLink to="/privacidade" icon={<ShieldCheck size={16} />} label="Política de privacidade" />
        </section>

        <div className="sticky bottom-3 z-20 flex gap-3 rounded-2xl bg-white/95 backdrop-blur border border-gray-200 shadow-xl p-3 mb-5">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 inline-flex items-center justify-center gap-2">
            <Save size={17} /> {saving ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>

        <button onClick={handleSignOut} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-red-200 text-red-500 font-semibold hover:bg-red-50 transition-colors">
          <LogOut size={16} /> Sair da conta
        </button>
      </div>
    </div>
  )
}

function PreferenceToggle({ checked, onChange, title, description }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-4">
      <div className="flex-1"><p className="text-sm font-bold text-gray-800">{title}</p><p className="text-xs text-gray-500 mt-0.5">{description}</p></div>
      <button type="button" role="switch" aria-checked={checked} aria-label={title} onClick={() => onChange(!checked)} className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${checked ? 'bg-primary-500' : 'bg-gray-300'}`}>
        <span className={`absolute left-0 top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

function SettingsLink({ to, icon, label }) {
  return <Link to={to} className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600 py-3 border-b border-gray-50 last:border-0 transition-colors"><span className="text-gray-400">{icon}</span><span className="flex-1">{label}</span><ChevronRight size={16} className="text-gray-300" /></Link>
}
