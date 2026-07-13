import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatDateBR } from '../../lib/formatDate'
import { Menu, X, Waves, User, CalendarDays, Heart, Settings, LogOut, LayoutDashboard, Bell } from 'lucide-react'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs, setNotifs] = useState([])
  const [unseen, setUnseen] = useState(0)
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (profile?.role !== 'host' || !user) { setNotifs([]); setUnseen(0); return }
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 60000)
    return () => clearInterval(interval)
  }, [profile?.role, user?.id])

  async function fetchNotifs() {
    const { data } = await supabase
      .from('bookings')
      .select('id, date, total_amount, properties(name), client:profiles!bookings_client_id_fkey(name)')
      .eq('host_id', user.id)
      .eq('status', 'confirmed')
      .eq('seen_by_host', false)
      .order('created_at', { ascending: false })
      .limit(10)
    setNotifs(data || [])
    setUnseen((data || []).length)
  }

  async function toggleNotifs() {
    const willOpen = !notifOpen
    setNotifOpen(willOpen)
    setMenuOpen(false)
    if (willOpen && unseen > 0) {
      const ids = notifs.map(n => n.id)
      await supabase.from('bookings').update({ seen_by_host: true }).in('id', ids)
      setUnseen(0)
    }
  }

  async function handleSignOut() {
    await signOut()
    setMenuOpen(false)
    navigate('/')
  }

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Waves className="text-primary-500" size={28} />
          <span className="font-bold text-xl text-gray-800">PoolDay</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link to="/explorar" className="text-gray-600 hover:text-primary-500 font-medium transition-colors">Explorar</Link>
          {profile?.role === 'host' && (
            <Link to="/anfitriao" className="text-gray-600 hover:text-primary-500 font-medium transition-colors">Meu Painel</Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {user && profile?.role === 'host' && (
            <div className="relative">
              <button onClick={toggleNotifs} className="relative flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 hover:shadow-md transition-all" aria-label="Notificações">
                <Bell size={18} className="text-gray-600" />
                {unseen > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unseen}</span>
                )}
              </button>
              {notifOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)}>
                  <div className="absolute right-4 top-16 w-80 max-w-[calc(100vw-2rem)] bg-white shadow-2xl rounded-2xl border border-gray-100 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b flex items-center gap-2">
                      <Bell size={16} className="text-primary-500" />
                      <span className="font-semibold text-gray-800">Notificações</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifs.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">Nenhuma reserva nova por aqui.</p>
                      ) : (
                        notifs.map(n => (
                          <Link key={n.id} to="/anfitriao" onClick={() => setNotifOpen(false)}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors">
                            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                              <CalendarDays size={16} className="text-green-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm text-gray-800 font-medium leading-snug">Nova reserva em {n.properties?.name || 'seu espaço'}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{n.client?.name ? `${n.client.name} · ` : ''}{formatDateBR(n.date)}{n.total_amount ? ` · R$ ${Number(n.total_amount).toLocaleString('pt-BR')}` : ''}</p>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                    <Link to="/anfitriao" onClick={() => setNotifOpen(false)} className="block text-center text-sm font-semibold text-primary-600 py-3 hover:bg-gray-50 border-t">
                      Ver painel do anfitrião
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
          {user ? (
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-2 hover:shadow-md transition-all">
              <Menu size={18} className="text-gray-600" />
              <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            </button>
          ) : (
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-2 hover:shadow-md transition-all">
              <Menu size={18} className="text-gray-600" />
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <User size={16} className="text-gray-500" />
              </div>
            </button>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
          <div className="absolute top-0 right-0 w-72 bg-white shadow-2xl rounded-bl-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Waves className="text-primary-500" size={22} />
                <span className="font-bold text-gray-800">PoolDay</span>
              </div>
              <button onClick={() => setMenuOpen(false)}>
                <X size={22} className="text-gray-500" />
              </button>
            </div>

            {user ? (
              <>
                <div className="p-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{profile?.name}</p>
                      <span className="text-xs bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full capitalize">
                        {profile?.role === 'host' ? 'Anfitrião' : 'Cliente'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  <MenuItem icon={<User size={18}/>} label="Ver perfil" to="/perfil" onClick={() => setMenuOpen(false)} />
                  <MenuItem icon={<CalendarDays size={18}/>} label="Minhas Reservas" to="/reservas" onClick={() => setMenuOpen(false)} />
                  <MenuItem icon={<Heart size={18}/>} label="Favoritos" to="/favoritos" onClick={() => setMenuOpen(false)} />
                  {profile?.role === 'host' && (
                    <MenuItem icon={<LayoutDashboard size={18}/>} label="Painel do Anfitrião" to="/anfitriao" onClick={() => setMenuOpen(false)} />
                  )}
                  <MenuItem icon={<Settings size={18}/>} label="Configurações" to="/configuracoes" onClick={() => setMenuOpen(false)} />
                  <div className="border-t mt-2 pt-2">
                    <button onClick={handleSignOut} className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                      <LogOut size={18}/>
                      <span className="font-medium">Sair</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-4 flex flex-col gap-3">
                <MenuItem icon={null} label="Explorar" to="/explorar" onClick={() => setMenuOpen(false)} />
                <Link to="/cadastro" onClick={() => setMenuOpen(false)} className="btn-primary text-center block">
                  Cadastre-se
                </Link>
                <Link to="/entrar" onClick={() => setMenuOpen(false)} className="btn-secondary text-center block">
                  Entrar
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

function MenuItem({ icon, label, to, onClick }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-colors">
      {icon && <span className="text-gray-500">{icon}</span>}
      <span className="font-medium">{label}</span>
    </Link>
  )
}
