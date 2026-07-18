import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Header from './components/common/Header'
import Footer from './components/common/Footer'
import Home from './pages/Home'
import Explore from './pages/Explore'
import Register from './pages/Register'
import Login from './pages/Login'
import PropertyDetail from './pages/PropertyDetail'
import HostDashboard from './pages/HostDashboard'
import NewProperty from './pages/NewProperty'
import ClientProfile from './pages/ClientProfile'
import Configuracoes from './pages/Configuracoes'
import HostWelcome from './pages/HostWelcome'
import OnboardingWizard from './pages/OnboardingWizard'
import HostProfile from './pages/HostProfile'
import AvailabilityCalendar from './pages/AvailabilityCalendar'
import Termos from './pages/Termos'
import Privacidade from './pages/Privacidade'
import AcordoAnfitriao from './pages/AcordoAnfitriao'
import Cancelamento from './pages/Cancelamento'
import NotFound from './pages/NotFound'
import ErrorBoundary from './components/common/ErrorBoundary'
import ScrollToTop from './components/common/ScrollToTop'

function ProtectedRoute({ children, hostOnly = false }) {
  const { user, profile, loading } = useAuth()
  if (loading || (user && !profile)) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  )
  if (!user) return <Navigate to="/entrar" replace />
  if (hostOnly && profile?.role !== 'host') return <Navigate to="/" replace />
  return children
}

function Layout({ children, noFooter = false }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">{children}</main>
      {!noFooter && <Footer />}
    </div>
  )
}

export default function App() {
  // Sinaliza ao CSS que o JS está vivo e vai cuidar da animação de revelar.
  // Enquanto esta classe não existir, todo bloco .reveal fica VISÍVEL
  // (ver index.css). Assim, se o JS falhar, o conteúdo nunca some —
  // só deixa de animar. Rodar cedo, aqui no topo, minimiza qualquer flash.
  useEffect(() => {
    document.documentElement.classList.add('js-reveal')
  }, [])

  return (
    <ErrorBoundary>
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Toaster position="top-center" toastOptions={{ duration: 3000, style: { borderRadius: '12px', fontFamily: 'Inter, sans-serif' } }} />
        <Routes>
          <Route path="/" element={<Layout><Home /></Layout>} />
          <Route path="/explorar" element={<Layout><Explore /></Layout>} />
          <Route path="/espaco/:id" element={<Layout noFooter><PropertyDetail /></Layout>} />
          <Route path="/anfitriao/:id/perfil" element={<Layout><HostProfile /></Layout>} />
          <Route path="/cadastro" element={<Register />} />
          <Route path="/entrar" element={<Login />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/acordo-anfitriao" element={<AcordoAnfitriao />} />
          <Route path="/cancelamento" element={<Cancelamento />} />
          <Route path="/perfil" element={<ProtectedRoute><Layout><ClientProfile /></Layout></ProtectedRoute>} />
          <Route path="/configuracoes" element={<ProtectedRoute><Layout><Configuracoes /></Layout></ProtectedRoute>} />
          <Route path="/reservas" element={<ProtectedRoute><Layout><ClientProfile tab="reservas" /></Layout></ProtectedRoute>} />
          <Route path="/favoritos" element={<ProtectedRoute><Layout><ClientProfile tab="favoritos" /></Layout></ProtectedRoute>} />
          <Route path="/anfitriao" element={<ProtectedRoute hostOnly><Layout><HostDashboard /></Layout></ProtectedRoute>} />
          <Route path="/anfitriao/boas-vindas" element={<ProtectedRoute hostOnly><Layout><HostWelcome /></Layout></ProtectedRoute>} />
          <Route path="/anfitriao/cadastrar-espaco" element={<ProtectedRoute hostOnly><Layout noFooter><OnboardingWizard /></Layout></ProtectedRoute>} />
          <Route path="/anfitriao/nova-piscina" element={<ProtectedRoute hostOnly><Layout><NewProperty /></Layout></ProtectedRoute>} />
          <Route path="/anfitriao/:id/calendario" element={<ProtectedRoute hostOnly><Layout><AvailabilityCalendar /></Layout></ProtectedRoute>} />
          <Route path="/anfitriao/editar/:id" element={<ProtectedRoute hostOnly><Layout><NewProperty /></Layout></ProtectedRoute>} />
          <Route path="*" element={<Layout><NotFound /></Layout>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  )
}
