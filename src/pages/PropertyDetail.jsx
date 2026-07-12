import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { MapPin, Users, Clock, Shield, Star, ChevronLeft, ChevronRight, Heart, Share2, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import BookingCalendar from '../components/common/BookingCalendar'

const amenityIcons = { 'Piscina': '🏊', 'Wi-Fi': '📶', 'Estacionamento': '🚗', 'Churrasco': '🍖', 'Spa': '🛁', 'Toalhas': '🛁', 'Drinks': '🥤', 'Vista mar': '🌊', 'Jardim': '🌿', 'Deck': '🪵' }

export default function PropertyDetail() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [property, setProperty] = useState(null)
  const [host, setHost] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [imgIndex, setImgIndex] = useState(0)
  const [selectedDate, setSelectedDate] = useState('')
  const [guests, setGuests] = useState(1)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [isFav, setIsFav] = useState(false)
  const [unavailableDates, setUnavailableDates] = useState(new Set())

  useEffect(() => { fetchProperty() }, [id])
  useEffect(() => { if (user && property) checkFavorite() }, [user, property])
  useEffect(() => { if (property) fetchUnavailable() }, [property])

  async function fetchProperty() {
    const { data } = await supabase.from('properties').select('*').eq('id', id).single()
    if (!data) { navigate('/explorar'); return }
    setProperty(data)
    document.title = `${data.name} em ${data.city} | PoolDay`
    const [{ data: hostData }, { data: reviewData }] = await Promise.all([
      supabase.from('profiles').select('name, created_at').eq('id', data.host_id).single(),
      supabase.from('reviews').select('rating, comment, created_at, reviewer:profiles!reviewer_id(name)').eq('property_id', id).order('created_at', { ascending: false }).limit(20),
    ])
    setHost(hostData)
    setReviews(reviewData || [])
    setLoading(false)
  }

  async function checkFavorite() {
    const { data } = await supabase.from('favorites').select('id').eq('user_id', user.id).eq('property_id', property.id).maybeSingle()
    setIsFav(!!data)
  }

  async function fetchUnavailable() {
    // RPC (SECURITY DEFINER) que devolve SO as datas indisponiveis do espaco
    // (bloqueadas + reservadas), sem expor quem reservou. Funciona pra qualquer visitante.
    const { data, error } = await supabase.rpc('get_unavailable_dates', { p_property_id: property.id })
    if (error) { console.error('get_unavailable_dates error:', error); return }
    setUnavailableDates(new Set((data || []).map(r => r.unavailable_date)))
  }

  async function toggleFavorite() {
    if (!user) { toast('Faça login para salvar favoritos'); navigate('/entrar'); return }
    if (isFav) {
      setIsFav(false)
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('property_id', property.id)
    } else {
      setIsFav(true)
      const { error } = await supabase.from('favorites').insert({ user_id: user.id, property_id: property.id })
      if (error && error.code !== '23505') setIsFav(false)
      else toast.success('Salvo nos favoritos!')
    }
  }

  async function handleShare() {
    const url = window.location.href
    const text = `${property.name} em ${property.city} — alugue por horas ou diária no PoolDay`
    if (navigator.share) {
      try { await navigator.share({ title: property.name, text, url }) } catch { /* cancelado */ }
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado!')
    }
  }

  async function handleBooking() {
    if (!user) { toast.error('Faça login para reservar!'); navigate('/entrar'); return }
    if (!selectedDate) { toast.error('Selecione uma data!'); return }
    if (guests < 1) { toast.error('Selecione o número de convidados!'); return }

    const weekday = new Date(selectedDate + 'T00:00:00').getDay()
    if (property.available_days?.length && !property.available_days.includes(weekday)) {
      toast.error('O anfitrião não atende nesse dia da semana.'); return
    }

    setBookingLoading(true)
    try {
      const { data: blocked } = await supabase.from('blocked_dates').select('id').eq('property_id', property.id).eq('date', selectedDate).maybeSingle()
      if (blocked) { toast.error('Essa data não está disponível.'); setBookingLoading(false); return }

      // Data ocupada se houver reserva confirmada, ou pendente criada há menos de 2h
      // (pendências antigas são pagamentos abandonados e não travam mais a data).
      const { data: existing } = await supabase.from('bookings').select('id, status, created_at').eq('property_id', property.id).eq('date', selectedDate).in('status', ['pending', 'confirmed'])
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
      const blockedByBooking = (existing || []).some(b => b.status === 'confirmed' || new Date(b.created_at).getTime() > twoHoursAgo)
      if (blockedByBooking) { toast.error('Essa data já foi reservada.'); setBookingLoading(false); return }

      const totalAmount = Number(property.price_per_day || property.price_per_hour)
      const { data: booking, error } = await supabase.from('bookings').insert({
        property_id: property.id,
        host_id: property.host_id,
        client_id: user.id,
        date: selectedDate,
        guests,
        total_amount: totalAmount,
        platform_fee: totalAmount * 0.15,
        host_amount: totalAmount * 0.85,
        status: 'pending',
      }).select().single()
      if (error) throw error

      // O valor final é recalculado NO SERVIDOR a partir do preço real do espaço.
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id }),
      })
      const data = await res.json()
      if (data.init_point) {
        window.location.href = data.init_point
      } else if (data.error === 'host_sem_mp') {
        toast.error('Este anfitrião ainda não ativou os pagamentos. Tente outro espaço ou volte em breve.', { duration: 5000 })
        await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
      } else {
        throw new Error(data.error || 'Erro ao criar pagamento')
      }
    } catch (err) {
      toast.error('Erro ao processar reserva. Tente novamente.')
      console.error(err)
    } finally { setBookingLoading(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  )

  if (!property) return null
  const images = property.images?.length ? property.images : ['https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?w=800&q=80']
  const totalAmount = Number(property.price_per_day || property.price_per_hour)
  const today = new Date().toISOString().split('T')[0]
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-0">
      {/* Galeria */}
      <div className="relative h-72 md:h-96 bg-gray-100 overflow-hidden">
        <img src={images[imgIndex]} alt={property.name} className="w-full h-full object-cover" />
        {images.length > 1 && (
          <>
            <button onClick={() => setImgIndex(i => (i - 1 + images.length) % images.length)} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-2 shadow hover:bg-white">
              <ChevronLeft size={20}/>
            </button>
            <button onClick={() => setImgIndex(i => (i + 1) % images.length)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-2 shadow hover:bg-white">
              <ChevronRight size={20}/>
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === imgIndex ? 'bg-white w-4' : 'bg-white/60'}`} />)}
            </div>
          </>
        )}
        <div className="absolute top-4 left-4 flex gap-2">
          <button onClick={() => navigate(-1)} className="bg-white/90 backdrop-blur-sm rounded-full p-2 hover:bg-white shadow"><ChevronLeft size={20}/></button>
        </div>
        <div className="absolute top-4 right-4 flex gap-2">
          <button onClick={handleShare} className="bg-white/90 backdrop-blur-sm rounded-full p-2 hover:bg-white shadow">
            <Share2 size={20} className="text-gray-600" />
          </button>
          <button onClick={toggleFavorite} className="bg-white/90 backdrop-blur-sm rounded-full p-2 hover:bg-white shadow">
            <Heart size={20} className={isFav ? 'text-red-500 fill-red-500' : 'text-gray-600'} />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-2xl font-bold text-gray-800">{property.name}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-4">
              {reviews.length > 0 && (
                <div className="flex items-center gap-1 font-semibold text-gray-700">
                  <Star size={14} className="text-yellow-400 fill-yellow-400"/>{avgRating.toFixed(1)} ({reviews.length})
                </div>
              )}
              <div className="flex items-center gap-1"><MapPin size={14}/>{property.city} — BR</div>
              <div className="flex items-center gap-1"><Users size={14}/>Até {property.max_capacity} pessoas</div>
              <div className="flex items-center gap-1"><Clock size={14}/>Por horas ou diária</div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {[
                { icon: <Users size={14}/>, label: `Até ${property.max_capacity} pessoas` },
                { icon: <Clock size={14}/>, label: 'Reserva garantida' },
                { icon: <Shield size={14}/>, label: 'Pagamento seguro' },
              ].map((tag, i) => (
                <span key={i} className="flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full">{tag.icon}{tag.label}</span>
              ))}
            </div>

            <div className="border-t pt-5 mb-5">
              <Link to={`/anfitriao/${property.host_id}/perfil`} className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold">
                  {host?.name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div>
                  <p className="font-semibold text-gray-800 group-hover:text-primary-500 transition-colors">Anfitrião: {host?.name}</p>
                  <p className="text-xs text-gray-400">Ver perfil</p>
                </div>
              </Link>
            </div>

            {property.description && (
              <div className="border-t pt-5 mb-5">
                <h2 className="font-bold text-gray-800 mb-2">Sobre o espaço</h2>
                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{property.description}</p>
              </div>
            )}

            {property.amenities?.length > 0 && (
              <div className="border-t pt-5 mb-5">
                <h2 className="font-bold text-gray-800 mb-3">Comodidades</h2>
                <div className="flex flex-wrap gap-2">
                  {property.amenities.map((a, i) => (
                    <span key={i} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-sm px-3 py-1.5 rounded-full">
                      {amenityIcons[a] || '✓'} {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {property.rules && (
              <div className="border-t pt-5 mb-5">
                <h2 className="font-bold text-gray-800 mb-2">Regras da casa</h2>
                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{property.rules}</p>
              </div>
            )}

            <div className="border-t pt-5">
              <h2 className="font-bold text-gray-800 mb-2">Localização aproximada</h2>
              <div className="flex items-center gap-2 text-gray-500 text-sm bg-gray-50 rounded-xl p-4">
                <MapPin size={16} className="text-primary-500"/>
                <span>{[property.neighborhood, property.city].filter(Boolean).join(', ')} — BR</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">O endereço completo será compartilhado após a confirmação da reserva.</p>
            </div>

            <div className="border-t pt-5 mt-5">
              <h2 className="font-bold text-gray-800 mb-3">Avaliações</h2>
              {reviews.length === 0 ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(s => <Star key={s} size={18} className="text-gray-200 fill-gray-200"/>)}
                  </div>
                  <p className="text-gray-500 text-sm">Nenhuma avaliação ainda. Seja o primeiro a reservar!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Star size={20} className="text-yellow-400 fill-yellow-400"/>
                    <span className="font-bold text-gray-800 text-lg">{avgRating.toFixed(1)}</span>
                    <span className="text-gray-500 text-sm">• {reviews.length} avaliaç{reviews.length > 1 ? 'ões' : 'ão'}</span>
                  </div>
                  {reviews.map((r, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-bold">
                          {r.reviewer?.name?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{r.reviewer?.name || 'Cliente'}</p>
                          <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map(s => <Star key={s} size={12} className={s <= r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}/>)}
                          </div>
                        </div>
                        <span className="ml-auto text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {r.comment && <p className="text-gray-600 text-sm mt-2">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Booking Card */}
          <div className="lg:w-96 shrink-0">
            <div className="sticky top-20 border-2 border-gray-100 rounded-3xl p-6 shadow-xl">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-bold text-gray-800">R$ {totalAmount.toLocaleString('pt-BR')}</span>
                <span className="text-gray-500">/diária</span>
              </div>
              <div className="mb-4" />

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Escolha a data</label>
                  <BookingCalendar
                    value={selectedDate}
                    onChange={setSelectedDate}
                    availableWeekdays={property.available_days}
                    unavailableDates={unavailableDates}
                  />
                </div>
              </div>

              {(property.hora_inicio != null && property.hora_fim != null) && (
                <div className="flex items-start gap-2 text-xs text-gray-500 mb-4 bg-gray-50 rounded-xl p-3">
                  <Clock size={14} className="text-primary-500 shrink-0 mt-0.5"/>
                  <span>
                    Funciona das <b className="text-gray-700">{String(property.hora_inicio).padStart(2,'0')}h às {String(property.hora_fim).padStart(2,'0')}h</b>
                    {property.min_duration > 1 && <> · mínimo de <b className="text-gray-700">{property.min_duration}h</b></>}. O horário exato é combinado com o anfitrião.
                  </span>
                </div>
              )}

              <button onClick={handleBooking} disabled={bookingLoading || !selectedDate} className="btn-primary w-full text-center mb-3 disabled:opacity-60">
                {bookingLoading ? 'Processando...' : 'Reservar agora'}
              </button>

              {selectedDate && (
                <div className="text-sm text-gray-600 space-y-1.5 pt-3 border-t">
                  <div className="flex justify-between"><span>R$ {totalAmount.toLocaleString('pt-BR')} x 1 diária</span><span>R$ {totalAmount.toLocaleString('pt-BR')}</span></div>
                  <div className="flex justify-between font-bold text-gray-800 pt-1 border-t"><span>Total</span><span>R$ {totalAmount.toLocaleString('pt-BR')}</span></div>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2">
                {[
                  { icon: <Shield size={14}/>, text: 'Pagamento 100% seguro via Mercado Pago' },
                  { icon: <CheckCircle size={14}/>, text: 'Reserva garantida' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="text-green-500">{item.icon}</span>{item.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex items-center justify-between lg:hidden z-40">
        <div><span className="font-bold text-gray-800 text-lg">R$ {totalAmount.toLocaleString('pt-BR')}</span><span className="text-gray-500 text-sm">/diária</span></div>
        <button onClick={handleBooking} disabled={bookingLoading || !selectedDate} className="btn-primary px-8 py-3 text-sm disabled:opacity-60">
          {bookingLoading ? 'Aguarde...' : 'Reservar'}
        </button>
      </div>
    </div>
  )
}
