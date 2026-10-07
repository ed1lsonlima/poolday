import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { isNoticeForOpenChat } from '../../lib/chatNotifications'
import { Menu, X, Waves, User, CalendarDays, Heart, Settings, LogOut, LayoutDashboard, Bell, BellOff, House, MessageCircle } from 'lucide-react'

async function playNoticeSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return
  const context = new AudioContext()
  try {
    await context.resume()
    const oscillator = context.createOscillator()
    const volume = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(740, context.currentTime)
    oscillator.frequency.setValueAtTime(980, context.currentTime + 0.12)
    volume.gain.setValueAtTime(0.0001, context.currentTime)
    volume.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02)
    volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32)
    oscillator.connect(volume).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.33)
    setTimeout(() => context.close(), 500)
  } catch { await context.close() }
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs, setNotifs] = useState([])
  const [unseen, setUnseen] = useState(0)
  const [popupNotification, setPopupNotification] = useState(null)
  const seenNoticeIds = useRef(new Set())
  const noticesInitialized = useRef(false)
  const { user, profile, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const showHomeButton = pathname !== '/'
  const bookingNotificationsEnabled = profile?.notification_preferences?.in_app_bookings !== false
  const messageNotificationsEnabled = profile?.notification_preferences?.in_app_messages !== false
  const notificationsEnabled = bookingNotificationsEnabled || messageNotificationsEnabled

  useEffect(() => { seenNoticeIds.current.clear(); noticesInitialized.current = false }, [user?.id])
  useEffect(() => { if (isNoticeForOpenChat(popupNotification, pathname)) setPopupNotification(null) }, [pathname, popupNotification])

  useEffect(() => {
    if (!user || !notificationsEnabled) { setNotifs([]); setUnseen(0); setPopupNotification(null); return }
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 15000)
    const onFocus = () => fetchNotifs()
    window.addEventListener('focus', onFocus)
    const channel = supabase.channel(`notifications:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, fetchNotifs)
      .subscribe()
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); supabase.removeChannel(channel) }
  }, [user?.id, bookingNotificationsEnabled, messageNotificationsEnabled, pathname])

  async function fetchNotifs() {
    const { data, error } = await supabase
      .from('notifications')
      .select('id,title,message,kind,booking_id,action_url,read_at,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) return
    const visible = (data || []).filter(item => item.kind?.startsWith('chat') ? messageNotificationsEnabled : bookingNotificationsEnabled)
    const fresh = visible.find(item => !item.read_at && !seenNoticeIds.current.has(item.id) && !isNoticeForOpenChat(item, pathname))
    for (const item of visible) seenNoticeIds.current.add(item.id)
    const displayed = visible.map(item => isNoticeForOpenChat(item, pathname) ? { ...item, read_at: item.read_at || new Date().toISOString() } : item)
    setNotifs(displayed)
    setUnseen(displayed.filter(item => !item.read_at).length)
    if (fresh && (noticesInitialized.current || Date.now() - new Date(fresh.created_at).getTime() < 5 * 60 * 1000)) {
      setPopupNotification(fresh)
      playNoticeSound()
    }
    noticesInitialized.current = true
  }

  async function toggleNotifs() {
    const willOpen = !notifOpen
    setNotifOpen(willOpen)
    if (willOpen) setPopupNotification(null)
    setMenuOpen(false)
    if (willOpen && notificationsEnabled && unseen > 0) {
      const ids = notifs.filter(item => !item.read_at).map(item => item.id)
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).in('id', ids)
      setNotifs(current => current.map(item => ({ ...item, read_at: new Date().toISOString() })))
      setUnseen(0)
    }
  }

  async function dismissPopup() {
    const notice = popupNotification
    if (!notice) return
    setPopupNotification(null)
    if (notice.read_at) return
    const readAt = new Date().toISOString()
    const { error } = await supabase.from('notifications').update({ read_at: readAt }).eq('id', notice.id).eq('user_id', user.id)
    if (!error) {
      setNotifs(current => current.map(item => item.id === notice.id ? { ...item, read_at: readAt } : item))
      setUnseen(current => Math.max(0, current - 1))
    }
  }

  async function handleSignOut() {
    await signOut()
    setMenuOpen(false)
    navigate('/')
  }

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      {popupNotification && <div role="status" className="absolute top-[4.5rem] right-3 sm:right-6 z-[70] w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-primary-100 bg-white shadow-2xl p-4 flex gap-3"><button type="button" onClick={toggleNotifs} className="min-w-0 flex-1 text-left"><p className="font-bold text-sm text-gray-900">{popupNotification.title}</p><p className="text-xs text-gray-600 mt-1 line-clamp-2">{popupNotification.message}</p><p className="text-xs font-semibold text-primary-600 mt-2">Abrir notificações →</p></button><button type="button" aria-label="Dispensar aviso" onClick={dismissPopup} className="self-start text-gray-400 hover:text-gray-700"><X size={18}/></button></div>}
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/" className="flex items-center gap-2" aria-label="PoolDay — página inicial">
            <Waves className="text-primary-500" size={28} />
            <span className="font-bold text-xl text-gray-800">PoolDay</span>
          </Link>
          {showHomeButton && (
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-100 bg-primary-50 px-2.5 py-1.5 text-xs font-semibold text-primary-600 transition-colors hover:border-primary-200 hover:bg-primary-100"
              aria-label="Voltar para a página inicial"
              title="Voltar para a página inicial"
            >
              <House size={14} />
              <span className="hidden sm:inline">Início</span>
            </Link>
          )}
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link to="/explorar" className="text-gray-600 hover:text-primary-500 font-medium transition-colors">Explorar</Link>
          {profile?.role === 'host' && (
            <Link to="/anfitriao" className="text-gray-600 hover:text-primary-500 font-medium transition-colors">Meu Painel</Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {user && (
            <div className="relative">
              <button onClick={toggleNotifs} className="relative flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 hover:shadow-md transition-all" aria-label="Notificações" aria-expanded={notifOpen}>
                {notificationsEnabled ? <Bell size={18} className="text-gray-600" /> : <BellOff size={18} className="text-gray-400" />}
                {unseen > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unseen}</span>
                )}
              </button>
              {notifOpen && (
                <div className="fixed inset-0 z-[60] bg-slate-900/10 sm:bg-transparent" onClick={() => setNotifOpen(false)}>
                  <div className="absolute right-2 sm:right-4 top-[4.5rem] w-[22rem] max-w-[calc(100vw-1rem)] bg-white shadow-2xl rounded-2xl border border-gray-100 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center"><Bell size={17} /></span>
                      <div className="flex-1"><span className="font-bold text-gray-800 block">Notificações</span><span className="text-[11px] text-gray-400">Pagamentos, reservas e mensagens</span></div>
                      {unseen > 0 && <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded-full">{unseen} nova{unseen > 1 ? 's' : ''}</span>}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {!notificationsEnabled ? (
                        <div className="text-center px-6 py-8"><BellOff size={30} className="text-gray-200 mx-auto mb-2" /><p className="font-semibold text-gray-600 text-sm">Avisos pausados</p><p className="text-xs text-gray-400 mt-1">Você pode reativá-los nas configurações.</p></div>
                      ) : notifs.length === 0 ? (
                        <div className="text-center px-6 py-8"><Bell size={30} className="text-gray-200 mx-auto mb-2" /><p className="font-semibold text-gray-600 text-sm">Tudo tranquilo por aqui</p><p className="text-xs text-gray-400 mt-1">Novas reservas confirmadas aparecerão neste espaço.</p></div>
                      ) : (
                        notifs.map(n => (
                          <Link key={n.id} to={n.action_url || (profile?.role === 'host' ? '/anfitriao' : '/reservas')} onClick={() => setNotifOpen(false)}
                            className={`relative flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 border-b border-gray-50 transition-colors ${!n.read_at ? 'bg-primary-50/50' : ''}`}>
                            {!n.read_at && <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary-500" />}
                            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                              {n.kind?.startsWith('chat') ? <MessageCircle size={16} className={n.kind === 'chat_urgent' ? 'text-amber-600' : 'text-green-600'} /> : <CalendarDays size={16} className="text-green-600" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm text-gray-800 font-medium leading-snug">{n.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                    <div className="grid grid-cols-2 border-t">
                      <Link to="/configuracoes" onClick={() => setNotifOpen(false)} className="text-center text-xs font-semibold text-gray-500 py-3 hover:bg-gray-50 border-r">Gerenciar avisos</Link>
                      <Link to={profile?.role === 'host' ? '/anfitriao' : '/reservas'} onClick={() => setNotifOpen(false)} className="text-center text-xs font-semibold text-primary-600 py-3 hover:bg-gray-50">Abrir painel</Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {user ? (
            <button aria-label="Abrir menu da conta" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-2 hover:shadow-md transition-all">
              <Menu size={18} className="text-gray-600" />
              <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            </button>
          ) : (
            <button aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-2 hover:shadow-md transition-all">
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
              <button aria-label="Fechar menu" onClick={() => setMenuOpen(false)}>
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
                  {isAdmin && <MenuItem icon={<LayoutDashboard size={18}/>} label="Administração PoolDay" to="/admin" onClick={() => setMenuOpen(false)} />}
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

