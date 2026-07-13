import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Busca o perfil do usuario. Se nao existir (ex.: primeiro login via Google),
  // cria um automaticamente a partir dos dados da conta.
  async function fetchProfile(authUser) {
    const userId = typeof authUser === 'string' ? authUser : authUser?.id
    if (!userId) return

    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (data) { setProfile(data); return }

    // Sem perfil: cria um (cobre login social, que nao passa pelo cadastro por email)
    const u = typeof authUser === 'object' ? authUser : null
    if (!u) return
    const meta = u.user_metadata || {}
    const novoPerfil = {
      id: userId,
      email: u.email,
      name: meta.name || meta.full_name || u.email?.split('@')[0] || 'Usuário',
      role: meta.role || 'client',
      phone: meta.phone || null,
    }
    const { data: criado } = await supabase.from('profiles').upsert(novoPerfil).select().maybeSingle()
    setProfile(criado || novoPerfil)
  }

  async function signUp({ name, email, password, phone, role }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role, phone } }
    })
    if (error) throw error
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id, name, email, phone, role
      })
      if (profileError) console.error('Erro ao salvar perfil:', profileError)
      await fetchProfile(data.user)
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
    await supabase.auth.signOut()
    setProfile(null)
  }

  async function updateProfile(updates) {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', user.id).select().single()
    if (error) throw error
    setProfile(data)
    return data
  }

  const isHost = profile?.role === 'host'
  const isClient = profile?.role === 'client'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isHost, isClient, signUp, signIn, signInWithGoogle, signOut, updateProfile, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
