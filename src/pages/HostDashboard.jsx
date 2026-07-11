import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Plus, LayoutDashboard, CreditCard, Star, Calendar, Eye, Edit, Trash2, CheckCircle, XCircle, Clock, Link2, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

export default function HostDashboard() {
  const { user, profile, fetchProfile } = useAuth()
  const [tab, setTab] = useState('dashboard')
  const [properties, setProperties] = useState([])
  const [bookings, setBookings] = useState([])
  const [stats, setStats] = useState({ total: 0, confirmed: 0, pending: 0, revenue: 0 })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (user) { fetchProperties(); fetchBookings() }
  }, [user])

  useEffect(() => {
    if (searchParams.get('mp_connected')) {
      toast.success('Conta do Mercado Pago conectada com sucesso!')
      setTab('pagamentos')
      if (user) fetchProfile?.(user.id)
    }
    if (searchParams.get('mp_error')) {
      toast.error('Nao foi possivel conectar o Mercado Pago. Tente novamente.')
      setTab('pagamentos')
    }
  }, [searchParams])

  async function fetchProperties() {
    const { data } = await supabase.from('properties').select('*').eq('host_id', user.id).order('created_at', { ascending: false })
    setProperties(data || [])
    setLoading(false)
  }

  async function fetchBookings() {
    const { data } = await supabase.from('bookings').select(`*, properties(name, images), profiles(name, email)`).eq('host_id', user.id).order('created_at', { ascending: false })
    const bk = data || []
    setBookings(bk)
    setStats({
      total: bk.length,
      confirmed: bk.filter(b => b.status === 'confirmed').length,
      pending: bk.filter(b => b.status === 'pending').length,
      revenue: bk.filter(b => b.status === 'confirmed').reduce((s, b) => s + Number(b.host_amount || 0), 0),
    })
  }

  const [mpLoading, setMpLoading] = useState(false)

  async function connectMP() {
    setMpLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Sessão expirada. Faça login novamente.'); return }
      const res = await fetch('/api/mp-connect', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else toast.error(data.error || 'Não foi possível iniciar a conexão.')
    } catch {
      toast.error('Erro de rede. Tente novamente.')
    } finally { setMpLoading(false) }
  }

  async function toggleActive(id, current) {
    await supabase.from('properties').update({ is_active: !current }).eq('id', id)
    fetchProperties()
    toast.success(!current ? 'Espaco ativado!' : 'Espaco pausado!')
  }

  async function deleteProperty(id) {
    if (!confirm('Tem certeza que deseja excluir este espaco?')) return
    await supabase.from('properties').delete().eq('id', id)
    fetchProperties()
    toast.success('Espaco excluido!')
  }

  const statusConfig = {
    pending: { label: 'Pendente', color: 'text-yellow-600 bg-yellow-50', icon: <Clock size={14}/> },
    confirmed: { label: 'Confirmada', color: 'text-green-600 bg-green-50', icon: <CheckCircle size={14}/> },
    cancelled: { label: 'Cancelada', color: 'text-red-600 bg-red-50', icon: <XCircle size={14}/> },
    completed: { label: 'Concluida', color: 'text-gray-600 bg-gray-100', icon: <CheckCircle size={14}/> },
  }

  if (!profile || profile.role !== 'host') {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-8">
        <div>
          <p className="text-5xl mb-4">🔒</p>
          <h2 className="text-xl font-bold mb-2">Area exclusiva para anfitrioes</h2>
          <p className="text-gray-500 mb-4">Crie uma conta como anfitriao para acessar.</p>
          <Link to="/cadastro?role=host" className="btn-primary">Criar conta de anfitriao</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Dashboard do Anfitriao</h1>
            <p className="text-gray-500 text-sm">Gerencie seus espacos e reservas</p>
          </div>
          <Link to="/anfitriao/nova-piscina" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={18} /> Novo Espaço
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('dashboard')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${tab === 'dashboard' ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            <LayoutDashboard size={16}/> Dashboard
          </button>
          <button onClick={() => setTab('pagamentos')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${tab === 'pagamentos' ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            <CreditCard size={16}/> Pagamentos
          </button>
        </div>

        {tab === 'dashboard' && (
          <>
            {/* Metricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Reservas', value: stats.total, color: 'text-primary-500' },
                { label: 'Confirmadas', value: stats.confirmed, color: 'text-green-500' },
                { label: 'Pendentes', value: stats.pending, color: 'text-yellow-500' },
                { label: 'Ganhos (R$)', value: `R$ ${stats.revenue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, color: 'text-primary-500' },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <p className="text-gray-500 text-xs uppercase font-semibold mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Minhas piscinas */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <h2 className="font-bold text-gray-800 mb-4">Meus Espaços</h2>
              {loading ? <p className="text-gray-400 text-sm">Carregando...</p> : properties.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-3">Nenhum espaco cadastrado ainda.</p>
                  <Link to="/anfitriao/nova-piscina" className="btn-primary text-sm">Cadastrar primeiro espaço</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {properties.map(p => (
                    <div key={p.id} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                      <img src={p.images?.[0] || 'https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?w=100'} alt={p.name} className="w-16 h-16 rounded-xl object-cover" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 truncate">{p.name}</h3>
                        <p className="text-sm text-gray-500">{p.city} • R$ {Number(p.price_per_day || p.price_per_hour).toLocaleString('pt-BR')}/diaria</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.is_active ? 'text-green-600 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>
                          {p.is_active ? 'Ativo' : 'Pausado'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => navigate(`/espaco/${p.id}`)} className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"><Eye size={16}/></button>
                        <button onClick={() => navigate(`/anfitriao/${p.id}/calendario`)} className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"><Calendar size={16}/></button>
                        <button onClick={() => navigate(`/anfitriao/editar/${p.id}`)} className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"><Edit size={16}/></button>
                        <button onClick={() => toggleActive(p.id, p.is_active)} className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-lg transition-colors">
                          {p.is_active ? <XCircle size={16}/> : <CheckCircle size={16}/>}
                        </button>
                        <button onClick={() => deleteProperty(p.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reservas */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-bold text-gray-800 mb-4">Todas as Reservas</h2>
              {bookings.length === 0 ? <p className="text-gray-400 text-sm">Nenhuma reserva ainda.</p> : (
                <div className="space-y-3">
                  {bookings.map(b => {
                    const st = statusConfig[b.status] || statusConfig.pending
                    return (
                      <div key={b.id} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 truncate">{b.properties?.name}</p>
                          <p className="text-sm text-gray-500">{b.profiles?.name} • {new Date(b.date).toLocaleDateString('pt-BR')}</p>
                          <p className="text-sm font-medium text-gray-700">R$ {Number(b.total_amount).toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
                        </div>
                        <span className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full ${st.color}`}>
                          {st.icon} {st.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'pagamentos' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                <ShieldCheck size={20} className="text-primary-500" /> Conta Mercado Pago
              </h2>
              {profile?.mp_connected ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl p-4">
                  <CheckCircle size={22} className="text-green-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-green-700 text-sm">Conta conectada</p>
                    <p className="text-green-600 text-xs mt-0.5">Voce ja pode receber pagamentos diretamente na sua conta Mercado Pago.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-yellow-50 border border-yellow-100 rounded-xl p-4">
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-700 text-sm">Conta nao conectada</p>
                    <p className="text-yellow-600 text-xs mt-0.5">Conecte sua conta Mercado Pago pra receber os pagamentos das suas reservas automaticamente.</p>
                  </div>
                  <button
                    onClick={connectMP}
                    disabled={mpLoading}
                    className="btn-primary flex items-center justify-center gap-2 text-sm whitespace-nowrap disabled:opacity-60"
                  >
                    <Link2 size={16} /> {mpLoading ? 'Abrindo...' : 'Conectar Mercado Pago'}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-bold text-gray-800 mb-2">Pagamentos via Mercado Pago</h2>
              <p className="text-gray-500 text-sm mb-6">Os repasses sao processados automaticamente. 15% de taxa de servico e descontada de cada reserva.</p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-green-50 rounded-xl p-5">
                  <p className="text-xs text-green-600 font-semibold uppercase">Total Recebido</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">R$ {stats.revenue.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-5">
                  <p className="text-xs text-yellow-600 font-semibold uppercase">Pendente</p>
                  <p className="text-2xl font-bold text-yellow-700 mt-1">R$ 0,00</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-5">
                  <p className="text-xs text-gray-500 font-semibold uppercase">Total Repasses</p>
                  <p className="text-2xl font-bold text-gray-700 mt-1">{stats.confirmed}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
