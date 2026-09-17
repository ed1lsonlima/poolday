import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [profileError, setProfileError] = useState('')
  const currentUserId = useRef(null)
  const profileRequest = useRef(0)

  useEffect(() => {
    let alive = true
    setIsAdmin(false)
    if (user) supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      try {
        const res = await fetch('/api/admin?action=access', { headers: { Authorization: `Bearer ${session.access_token}` } })
        const data = res.ok ? await res.json() : null
        if (alive) setIsAdmin(data?.isAdmin === true)
      } catch { /* Admin entry remains hidden; server still enforces access. */ }
    })
    return () => { alive = false }
  }, [user?.id])

  useEffect(() => {
    let alive = true
    let authEventReceived = false
    function acceptSession(session) {
      if (!alive) return
      const nextUser = session?.user ?? null
      if (currentUserId.current !== nextUser?.id) {
        currentUserId.current = nextUser?.id ?? null
        profileRequest.current++
        setProfile(null)
        setProfileError('')
        setIsAdmin(false)
      }
      setUser(nextUser)
      if (!nextUser) setLoading(false)
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventReceived = true
      acceptSession(session)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      // A newer sign-in/sign-out event always wins over the initial read.
      if (!authEventReceived) acceptSession(session)
    }).catch(() => { if (alive && !authEventReceived) acceptSession(null) })
    return () => { alive = false; profileRequest.current++; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (user) fetchProfile(user)
    return () => { profileRequest.current++ }
  }, [user?.id])

  // Busca o perfil do usuario. Se nao existir (ex.: primeiro login via Google),
  // cria um automaticamente a partir dos dados da conta.
  async function fetchProfile(authUser) {
    const userId = typeof authUser === 'string' ? authUser : authUser?.id
    if (!userId || userId !== currentUserId.current) return null
    const request = ++profileRequest.current
    const isCurrent = () => request === profileRequest.current && userId === currentUserId.current
    setLoading(true)
    setProfileError('')
    try {
      let { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      if (error) throw error
      if (!isCurrent()) return null
      if (!data) {
        const u = typeof authUser === 'object' ? authUser : null
        if (!u) throw new Error('PROFILE_NOT_FOUND')
        const meta = u.user_metadata || {}
        // INSERT only: a failed read or concurrent creation must never overwrite
        // an existing role (especially the owner's host account).
        const result = await supabase.from('profiles').insert({
          id: userId,
          email: u.email,
          name: meta.name || meta.full_name || u.email?.split('@')[0] || 'Usuário',
          role: meta.role === 'host' ? 'host' : 'client',
          phone: meta.phone || null,
        }).select().single()
        if (result.error?.code === '23505') {
          const existing = await supabase.from('profiles').select('*').eq('id', userId).single()
          if (existing.error) throw existing.error
          data = existing.data
        } else {
          if (result.error) throw result.error
          data = result.data
        }
      }
      if (isCurrent()) setProfile(data)
      return data
    } catch {
      if (isCurrent()) setProfileError('Não foi possível carregar sua conta. Verifique a conexão e tente novamente.')
      return null
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }

  async function signUp({ name, email, password, phone, city, state, municipality_code, role }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role, phone, city, state, municipality_code } }
    })
    if (error) throw error
    if (data.session && data.user) {
      // The signup trigger owns identity/role; this only fills optional contact/location.
      await supabase.from('profiles').update({ phone: phone || null, city: city || null, state: state || null, municipality_code: municipality_code || null }).eq('id', data.user.id)
    }
    return data
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    currentUserId.current = null
    profileRequest.current++
    setUser(null)
    setProfile(null)
    setProfileError('')
    setIsAdmin(false)
  }

  async function updateProfile(updates) {
    const userId = currentUserId.current
    if (!userId) throw new Error('Entre na sua conta novamente.')
    const allowed = ['name', 'phone', 'city', 'state', 'municipality_code', 'avatar_url', 'bio']
    const fields = Object.fromEntries(Object.entries(updates).filter(([key]) => allowed.includes(key)))
    const { data, error } = await supabase.from('profiles').update(fields).eq('id', userId).select().single()
    if (error) throw error
    if (currentUserId.current === userId) setProfile(data)
    return data
  }

  const isHost = profile?.role === 'host'
  const isClient = profile?.role === 'client'

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileError, retryProfile: () => fetchProfile(user), isHost, isClient, isAdmin, signUp, signIn, signInWithGoogle, signOut, updateProfile, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
