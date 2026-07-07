import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

function ProtectedRoute({ children, hostOnly = false }) {
  const { user, profile, loading } = useAuth()
  if (loading) return (
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
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" toastOptions={{ duration: 3000, style: { borderRadius: '12px', fontFamily: 'Inter, sans-serif' } }} />
        <Routes>
          <Route path="/" element={<Layout><Home /></Layout>} />
          <Route path="/explorar" element={<Layout><Explore /></Layout>} />
          <Route path="/espaco/:id" element={<Layout noFooter><PropertyDetail /></Layout>} />
          <Route path="/cadastro" element={<Register />} />
          <Route path="/entrar" element={<Login />} />
          <Route path="/perfil" element={<ProtectedRoute><Layout><ClientProfile /></Layout></ProtectedRoute>} />
          <Route path="/reservas" element={<ProtectedRoute><Layout><ClientProfile tab="reservas" /></Layout></ProtectedRoute>} />
          <Route path="/favoritos" element={<ProtectedRoute><Layout><ClientProfile tab="favoritos" /></Layout></ProtectedRoute>} />
          <Route path="/anfitriao" element={<ProtectedRoute hostOnly><Layout><HostDashboard /></Layout></ProtectedRoute>} />
          <Route path="/anfitriao/nova-piscina" element={<ProtectedRoute hostOnly><Layout><NewProperty /></Layout></ProtectedRoute>} />
          <Route path="/anfitriao/editar/:id" element={<ProtectedRoute hostOnly><Layout><NewProperty /></Layout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
