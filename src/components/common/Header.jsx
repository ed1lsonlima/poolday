import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Menu, X, Waves, User, CalendarDays, Heart, Settings, LogOut, LayoutDashboard } from 'lucide-react'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

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
                  <MenuItem icon={<Settings size={18}/>} label="Configurações" to="/perfil" onClick={() => setMenuOpen(false)} />
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
