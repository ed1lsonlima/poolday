import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Header from './components/common/Header'
import Footer from './components/common/Footer'
import ErrorBoundary from './components/common/ErrorBoundary'
import ScrollToTop from './components/common/ScrollToTop'

const Home = lazy(() => import('./pages/Home'))
const Explore = lazy(() => import('./pages/Explore'))
const Register = lazy(() => import('./pages/Register'))
const Login = lazy(() => import('./pages/Login'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const PropertyDetail = lazy(() => import('./pages/PropertyDetail'))
const HostDashboard = lazy(() => import('./pages/HostDashboard'))
const NewProperty = lazy(() => import('./pages/NewProperty'))
const ClientProfile = lazy(() => import('./pages/ClientProfile'))
const Configuracoes = lazy(() => import('./pages/Configuracoes'))
const HostWelcome = lazy(() => import('./pages/HostWelcome'))
const OnboardingWizard = lazy(() => import('./pages/OnboardingWizard'))
const HostProfile = lazy(() => import('./pages/HostProfile'))
const AvailabilityCalendar = lazy(() => import('./pages/AvailabilityCalendar'))
const Termos = lazy(() => import('./pages/Termos'))
const Privacidade = lazy(() => import('./pages/Privacidade'))
const AcordoAnfitriao = lazy(() => import('./pages/AcordoAnfitriao'))
const Cancelamento = lazy(() => import('./pages/Cancelamento'))
const NotFound = lazy(() => import('./pages/NotFound'))
const SejaAnfitriao = lazy(() => import('./pages/SejaAnfitriao'))

const META = {
  '/': ['PoolDay — Alugue Piscinas e Espaços de Lazer por Diária', 'Reserve piscinas, chácaras e espaços de lazer por diária com pagamento seguro.'],
  '/explorar': ['Explorar espaços — PoolDay', 'Encontre piscinas e espaços de lazer disponíveis para reservar por diária.'],
  '/cadastro': ['Criar conta — PoolDay', 'Crie sua conta no PoolDay para reservar ou anunciar um espaço.'],
  '/entrar': ['Entrar — PoolDay', 'Entre na sua conta PoolDay.'],
  '/recuperar-senha': ['Recuperar senha — PoolDay', 'Receba um link seguro para redefinir sua senha.'],
  '/redefinir-senha': ['Redefinir senha — PoolDay', 'Cadastre uma nova senha para sua conta PoolDay.'],
  '/seja-anfitriao': ['Anuncie seu espaço — PoolDay', 'Anuncie gratuitamente e receba 100% do valor nas 3 primeiras reservas.'],
  '/termos': ['Termos de Uso — PoolDay', 'Termos de uso da plataforma PoolDay.'],
  '/privacidade': ['Política de Privacidade — PoolDay', 'Como o PoolDay coleta, utiliza e protege seus dados.'],
  '/acordo-anfitriao': ['Acordo do Anfitrião — PoolDay', 'Condições para anunciar espaços no PoolDay.'],
  '/cancelamento': ['Política de Cancelamento — PoolDay', 'Regras de cancelamento e reembolso de reservas no PoolDay.'],
}

function PageMeta() {
  const { pathname } = useLocation()
  useEffect(() => {
    const [title, description] = META[pathname] || (pathname.startsWith('/espaco/')
      ? ['Espaço para reservar — PoolDay', 'Veja fotos, comodidades e disponibilidade deste espaço.']
      : ['PoolDay — Piscinas e espaços de lazer', 'Reserve espaços de lazer por diária.'])
    document.title = title
    const canonical = document.querySelector('link[rel="canonical"]')
    if (canonical) canonical.href = `https://www.pooldaybr.com${pathname === '/' ? '/' : pathname}`
    const descriptionTag = document.querySelector('meta[name="description"]')
    if (descriptionTag) descriptionTag.content = description
    const ogUrl = document.querySelector('meta[property="og:url"]')
    if (ogUrl) ogUrl.content = `https://www.pooldaybr.com${pathname === '/' ? '/' : pathname}`
  }, [pathname])
  return null
}

function PageLoading() {
  return <div className="min-h-[50vh] flex items-center justify-center" aria-label="Carregando página"><div className="animate-spin w-9 h-9 border-4 border-primary-500 border-t-transparent rounded-full" /></div>
}

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
        <PageMeta />
        <Toaster position="top-center" toastOptions={{ duration: 3000, style: { borderRadius: '12px', fontFamily: 'Inter, sans-serif' } }} />
        <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<Layout><Home /></Layout>} />
          <Route path="/explorar" element={<Layout><Explore /></Layout>} />
          <Route path="/espaco/:id" element={<Layout noFooter><PropertyDetail /></Layout>} />
          <Route path="/anfitriao/:id/perfil" element={<Layout><HostProfile /></Layout>} />
          <Route path="/cadastro" element={<Register />} />
          {/* Landing do Google Ads pra captar anfitriao (standalone, sem Header/Footer) */}
          <Route path="/seja-anfitriao" element={<SejaAnfitriao />} />
          <Route path="/entrar" element={<Login />} />
          <Route path="/recuperar-senha" element={<ForgotPassword />} />
          <Route path="/redefinir-senha" element={<ResetPassword />} />
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
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  )
}

