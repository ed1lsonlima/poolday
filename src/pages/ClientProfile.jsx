import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { User, CalendarDays, Heart, Edit2, MapPin, Star, X, Users, CheckCircle, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link, useSearchParams } from 'react-router-dom'
import { formatDateBR } from '../lib/formatDate'
import PropertyCard from '../components/common/PropertyCard'

// Monta um link de WhatsApp pro anfitriao com mensagem pronta.
function waLink(phone, propName, date) {
  const digits = String(phone || '').replace(/\D/g, '')
  const withCountry = digits.startsWith('55') ? digits : '55' + digits
  const msg = `Olá! Fiz uma reserva no PoolDay${propName ? ` para "${propName}"` : ''}${date ? ` no dia ${formatDateBR(date)}` : ''}. Gostaria de combinar os detalhes.`
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}`
}

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
  const [detail, setDetail] = useState(null) // booking aberto no modal de detalhes
  const [confirming, setConfirming] = useState(false) // aguardando confirmacao do pagamento
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => { if (profile) setForm({ name: profile.name || '', phone: profile.phone || '', city: profile.city || '' }) }, [profile])
  useEffect(() => { if (user) { fetchBookings(); fetchFavorites(); fetchMyReviews() } }, [user])
  // Sincroniza a aba quando a rota muda (a mesma instancia e reaproveitada entre /perfil, /reservas e /favoritos).
  useEffect(() => { setTab(initialTab) }, [initialTab])

  // Bug A: ao voltar do Mercado Pago, faz polling do status ate o webhook confirmar.
  useEffect(() => {
    const pg = searchParams.get('pagamento')
    if (!user || (pg !== 'sucesso' && pg !== 'pendente')) return
    setTab('reservas')
    setConfirming(true)
    let tries = 0
    let cancelled = false
    let interval
    const check = async () => {
      if (cancelled) return
      const list = await fetchBookings()
      tries++
      const newest = list?.[0]
      if (newest?.status === 'confirmed') {
        setConfirming(false)
        clearInterval(interval)
        toast.success('Reserva confirmada!')
        setDetail(newest)
        const sp = new URLSearchParams(searchParams)
        sp.delete('pagamento')
        setSearchParams(sp, { replace: true })
      } else if (tries >= 12) {
        setConfirming(false)
        clearInterval(interval)
      }
    }
    check()
    interval = setInterval(check, 3000)
    return () => { cancelled = true; clearInterval(interval) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function fetchBookings() {
    const { data } = await supabase.from('bookings').select('*, properties(name, images, city, neighborhood, address), host:profiles!bookings_host_id_fkey(name, phone)').eq('client_id', user.id).order('created_at', { ascending: false })
    setBookings(data || [])
    return data || []
  }

  async function fetchFavorites() {
    const { data } = await supabase.from('favorites').select('id, properties(*)').eq('user_id', user.id).order('created_at', { ascending: false })
    setFavorites((data || []).map(f => f.properties).filter(Boolean))
  }

  async function removeFavorite(propertyId) {
    setFavorites(favs => favs.filter(f => f.id !== propertyId))
    const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('property_id', propertyId)
    if (error) { toast.error('Erro ao remover.'); fetchFavorites() }
    else toast.success('Removido dos favoritos.')
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

        {/* Banner de confirmacao de pagamento (Bug A) */}
        {confirming && (
          <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
            <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full shrink-0" />
            <div>
              <p className="font-semibold text-blue-700 text-sm">Confirmando seu pagamento...</p>
              <p className="text-blue-600 text-xs mt-0.5">Assim que o Mercado Pago confirmar, sua reserva vira <b>Confirmada</b> aqui automaticamente. Pode levar alguns segundos.</p>
            </div>
          </div>
        )}

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
              <Link to="/configuracoes" className="flex items-center gap-1.5 text-primary-500 text-sm font-semibold hover:underline"><Edit2 size={14}/> Editar</Link>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Nome', key: 'name' },
                { label: 'Telefone', key: 'phone' },
                { label: 'Cidade', key: 'city' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">{f.label}</label>
                  <p className="text-gray-700 py-2 border-b border-gray-100">{form[f.key] || <span className="text-gray-400 italic">Não informado</span>}</p>
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Email</label>
                <p className="text-gray-500 py-2 border-b border-gray-100">{user?.email}</p>
              </div>
            </div>
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
                    <div className="flex gap-4 cursor-pointer group" onClick={() => setDetail(b)}>
                      <img src={b.properties?.images?.[0] || 'https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?w=100'} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate group-hover:text-primary-500 transition-colors">{b.properties?.name}</p>
                        <div className="flex items-center gap-1 text-gray-400 text-xs mt-0.5"><MapPin size={11}/>{b.properties?.city}</div>
                        <p className="text-xs text-gray-500 mt-1">{formatDateBR(b.date)} • R$ {Number(b.total_amount).toLocaleString('pt-BR')}</p>
                        <p className="text-[11px] text-primary-400 mt-1 group-hover:underline">Ver detalhes</p>
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-800 mb-4">Meus Favoritos {favorites.length > 0 && <span className="text-gray-400 font-normal text-sm">({favorites.length})</span>}</h2>
            {favorites.length === 0 ? (
              <div className="text-center py-10">
                <Heart size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 mb-3">Nenhum favorito ainda.</p>
                <Link to="/explorar" className="btn-primary text-sm">Explorar espaços</Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {favorites.map(p => (
                  <div key={p.id} className="relative">
                    <PropertyCard property={p} />
                    <button onClick={() => removeFavorite(p.id)} title="Remover dos favoritos" aria-label="Remover dos favoritos"
                      className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow hover:bg-white z-10 transition-colors">
                      <Heart size={16} className="text-red-500 fill-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de detalhes da reserva (Bug B) */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="relative h-40 bg-gray-100">
              <img src={detail.properties?.images?.[0] || 'https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?w=400'} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setDetail(null)} className="absolute top-3 right-3 bg-white/90 rounded-full p-1.5 shadow hover:bg-white"><X size={18} className="text-gray-600"/></button>
              <span className={`absolute bottom-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[detail.status] || statusColors.pending}`}>
                {statusLabels[detail.status] || 'Pendente'}
              </span>
            </div>
            <div className="p-6">
              <h3 className="font-bold text-gray-800 text-lg mb-1">{detail.properties?.name}</h3>
              <div className="flex items-center gap-1 text-gray-400 text-sm mb-4">
                <MapPin size={13}/>{[detail.properties?.neighborhood, detail.properties?.city].filter(Boolean).join(', ') || 'Localização não informada'}
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 flex items-center gap-1.5"><CalendarDays size={14}/> Data</span>
                  <span className="font-medium text-gray-800">{formatDateBR(detail.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 flex items-center gap-1.5"><Users size={14}/> Convidados</span>
                  <span className="font-medium text-gray-800">{detail.guests} pessoa{detail.guests > 1 ? 's' : ''}</span>
                </div>
                <div className="flex justify-between border-t pt-2.5">
                  <span className="text-gray-500">Valor total</span>
                  <span className="font-bold text-gray-800">R$ {Number(detail.total_amount).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>
              </div>
              {detail.status === 'confirmed' ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl p-3.5 bg-green-50 border border-green-100">
                    <p className="text-sm font-semibold text-green-700 mb-1.5 flex items-center gap-1.5"><CheckCircle size={15}/> Reserva confirmada! Próximos passos:</p>
                    <ol className="text-xs text-green-700/90 space-y-1 list-decimal list-inside">
                      <li>Combine o horário de chegada com o anfitrião pelo WhatsApp.</li>
                      <li>No dia {formatDateBR(detail.date)}, é só chegar no endereço abaixo.</li>
                      <li>Aproveite! Qualquer dúvida, fale direto com o anfitrião.</li>
                    </ol>
                  </div>
                  {detail.properties?.address && (
                    <div className="rounded-xl p-3 bg-gray-50 text-xs text-gray-600">📍 <b>Endereço:</b> {detail.properties.address}</div>
                  )}
                  {detail.host?.phone ? (
                    <a href={waLink(detail.host.phone, detail.properties?.name, detail.date)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-500 text-white font-semibold text-sm hover:bg-green-600 transition-colors">
                      <MessageCircle size={16}/> Falar com {detail.host?.name || 'o anfitrião'} no WhatsApp
                    </a>
                  ) : (
                    <p className="text-xs text-gray-400 text-center">O anfitrião entrará em contato com os detalhes de acesso.</p>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-xl p-3 text-xs bg-gray-50 text-gray-600 leading-relaxed">
                  {detail.status === 'pending' ? '⏳ Aguardando a confirmação do pagamento. Assim que confirmar, o endereço e o contato do anfitrião aparecem aqui.'
                    : detail.status === 'cancelled' ? 'Esta reserva foi cancelada.'
                    : 'Reserva concluída. Obrigado por usar o PoolDay!'}
                </div>
              )}
              {detail.status === 'pending' && (
                <button onClick={() => { const b = detail; setDetail(null); cancelBooking(b) }} className="w-full mt-4 text-sm font-semibold text-red-500 border border-red-200 rounded-xl py-2.5 hover:bg-red-50 transition-colors">
                  Cancelar reserva
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
