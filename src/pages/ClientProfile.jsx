import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { User, CalendarDays, Heart, Edit2, MapPin, Star, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import PropertyCard from '../components/common/PropertyCard'

export default function ClientProfile({ tab: initialTab = 'perfil' }) {
  const { user, profile, updateProfile } = useAuth()
  const [tab, setTab] = useState(initialTab)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', city: '' })
  const [bookings, setBookings] = useState([])
  const [favorites, setFavorites] = useState([])
  const [myReviews, setMyReviews] = useState([])
  const [reviewing, setReviewing] = useState(null) // booking sendo avaliado
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (profile) setForm({ name: profile.name || '', phone: profile.phone || '', city: profile.city || '' }) }, [profile])
  useEffect(() => { if (user) { fetchBookings(); fetchFavorites(); fetchMyReviews() } }, [user])

  async function fetchBookings() {
    const { data } = await supabase.from('bookings').select('*, properties(name, images, city)').eq('client_id', user.id).order('created_at', { ascending: false })
    setBookings(data || [])
  }

  async function fetchFavorites() {
    const { data } = await supabase.from('favorites').select('id, properties(*)').eq('user_id', user.id).order('created_at', { ascending: false })
    setFavorites((data || []).map(f => f.properties).filter(Boolean))
  }

  async function fetchMyReviews() {
    const { data } = await supabase.from('reviews').select('booking_id').eq('reviewer_id', user.id)
    setMyReviews((data || []).map(r => r.booking_id))
  }

  async function handleSave() {
    setLoading(true)
    try {
      await updateProfile(form)
      toast.success('Perfil atualizado!')
      setEditing(false)
    } catch { toast.error('Erro ao salvar') }
    finally { setLoading(false) }
  }

  async function cancelBooking(b) {
    if (!confirm('Cancelar esta reserva?')) return
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', b.id).eq('client_id', user.id)
    if (error) { toast.error('Não foi possível cancelar.'); return }
    toast.success('Reserva cancelada.')
    fetchBookings()
  }

  async function submitReview() {
    if (!reviewing) return
    setLoading(true)
    try {
      const { error } = await supabase.from('reviews').insert({
        booking_id: reviewing.id,
        reviewer_id: user.id,
        property_id: reviewing.property_id,
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim() || null,
      })
      if (error) throw error
      toast.success('Avaliação enviada. Obrigado!')
      setReviewing(null)
      setReviewForm({ rating: 5, comment: '' })
      fetchMyReviews()
    } catch (e) {
      toast.error(e.code === '23505' ? 'Você já avaliou esta reserva.' : 'Erro ao enviar avaliação.')
    } finally { setLoading(false) }
  }

  const statusColors = { pending: 'text-yellow-600 bg-yellow-50', confirmed: 'text-green-600 bg-green-50', cancelled: 'text-red-600 bg-red-50', completed: 'text-gray-600 bg-gray-100' }
  const statusLabels = { pending: 'Pendente', confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Concluída' }
  const today = new Date().toISOString().split('T')[0]
  const canReview = b => ['confirmed', 'completed'].includes(b.status) && b.date <= today && !myReviews.includes(b.id)

  const tabs = [
    { id: 'perfil', label: 'Perfil', icon: <User size={16}/> },
    { id: 'reservas', label: 'Reservas', icon: <CalendarDays size={16}/> },
    { id: 'favoritos', label: 'Favoritos', icon: <Heart size={16}/> },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-primary-500 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-3">
            {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <h1 className="text-xl font-bold text-gray-800">{profile?.name}</h1>
          <span className="mt-1 text-xs bg-primary-100 text-primary-600 px-3 py-1 rounded-full font-semibold capitalize">
            {profile?.role === 'host' ? 'Anfitrião' : 'Cliente'}
          </span>
          <p className="text-gray-400 text-xs mt-1">Membro desde {profile?.created_at ? new Date(profile.created_at).getFullYear() : '2026'}</p>
          <div className="flex gap-6 mt-4 text-center">
            {[{label:'Avaliações',val:myReviews.length},{label:'Reservas',val:bookings.length},{label:'Favoritos',val:favorites.length}].map((s,i)=>(
              <div key={i}><p className="text-xl font-bold text-gray-800">{s.val}</p><p className="text-xs text-gray-500">{s.label}</p></div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${tab === t.id ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Perfil */}
        {tab === 'perfil' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-800">Informações pessoais</h2>
              <button onClick={() => setEditing(!editing)} className="flex items-center gap-1.5 text-primary-500 text-sm font-semibold hover:underline"><Edit2 size={14}/>{editing ? 'Cancelar' : 'Editar'}</button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Nome', key: 'name', placeholder: 'Seu nome' },
                { label: 'Telefone', key: 'phone', placeholder: '(11) 99999-9999' },
                { label: 'Cidade', key: 'city', placeholder: 'Sua cidade' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">{f.label}</label>
                  {editing ? (
                    <input className="input-field" placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})} />
                  ) : (
                    <p className="text-gray-700 py-2 border-b border-gray-100">{form[f.key] || <span className="text-gray-400 italic">Não informado</span>}</p>
                  )}
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Email</label>
                <p className="text-gray-500 py-2 border-b border-gray-100">{user?.email}</p>
              </div>
            </div>
            {editing && (
              <button onClick={handleSave} disabled={loading} className="btn-primary w-full mt-5">{loading ? 'Salvando...' : 'Salvar alterações'}</button>
            )}
          </div>
        )}

        {/* Reservas */}
        {tab === 'reservas' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-800 mb-4">Minhas Reservas</h2>
            {bookings.length === 0 ? (
              <div className="text-center py-10">
                <CalendarDays size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 mb-3">Nenhuma reserva ainda.</p>
                <Link to="/explorar" className="btn-primary text-sm">Explorar espaços</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map(b => (
                  <div key={b.id} className="p-3 rounded-xl border border-gray-100">
                    <div className="flex gap-4">
                      <img src={b.properties?.images?.[0] || 'https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?w=100'} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{b.properties?.name}</p>
                        <div className="flex items-center gap-1 text-gray-400 text-xs mt-0.5"><MapPin size={11}/>{b.properties?.city}</div>
                        <p className="text-xs text-gray-500 mt-1">{new Date(b.date + 'T00:00:00').toLocaleDateString('pt-BR')} • R$ {Number(b.total_amount).toLocaleString('pt-BR')}</p>
                      </div>
                      <span className={`self-start text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${statusColors[b.status] || statusColors.pending}`}>
                        {statusLabels[b.status] || 'Pendente'}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {b.status === 'pending' && (
                        <button onClick={() => cancelBooking(b)} className="text-xs font-semibold text-red-500 hover:underline">Cancelar reserva</button>
                      )}
                      {canReview(b) && (
                        <button onClick={() => setReviewing(b)} className="flex items-center gap-1 text-xs font-semibold text-primary-500 hover:underline">
                          <Star size={12}/> Avaliar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Favoritos */}
        {tab === 'favoritos' && (
          favorites.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center py-10">
              <Heart size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 mb-3">Nenhum favorito ainda.</p>
              <Link to="/explorar" className="btn-primary text-sm">Explorar espaços</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {favorites.map(p => <PropertyCard key={p.id} property={p} />)}
            </div>
          )
        )}
      </div>

      {/* Modal de avaliação */}
      {reviewing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setReviewing(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Avaliar {reviewing.properties?.name}</h3>
              <button onClick={() => setReviewing(null)}><X size={20} className="text-gray-400"/></button>
            </div>
            <div className="flex justify-center gap-2 mb-4">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setReviewForm({...reviewForm, rating: s})}>
                  <Star size={32} className={s <= reviewForm.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
                </button>
              ))}
            </div>
            <textarea
              className="input-field w-full h-24 resize-none"
              placeholder="Conte como foi sua experiência (opcional)"
              value={reviewForm.comment}
              maxLength={500}
              onChange={e => setReviewForm({...reviewForm, comment: e.target.value})}
            />
            <button onClick={submitReview} disabled={loading} className="btn-primary w-full mt-4">{loading ? 'Enviando...' : 'Enviar avaliação'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
