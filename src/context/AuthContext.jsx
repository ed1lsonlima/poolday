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
                if (session?.user) fetchProfile(session.user.id)
                setLoading(false)
        })

                const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                        setUser(session?.user ?? null)
                        if (session?.user) fetchProfile(session.user.id)
                        else setProfile(null)
                })

                return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
        setProfile(data)
  }

  async function signUp({ name, email, password, phone, role }) {
        const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { name, role } }
        })
                if (error) throw error
        if (data.user) {
                const { error: profileError } = await supabase.from('profiles').upsert({
                          id: data.user.id, name, email, phone, role
                })
                if (profileError) console.error('Erro ao salvar perfil:', profileError)
                await fetchProfile(data.user.id)
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
