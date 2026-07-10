import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { MapPin, Users, Clock, Shield, Star, ChevronLeft, ChevronRight, Heart, Share2, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const amenityIcons = { 'Piscina': '🏊', 'Wi-Fi': '📶', 'Estacionamento': '🚗', 'Churrasco': '🍖', 'Spa': '🛁', 'Toalhas': '🛁', 'Drinks': '🥤', 'Vista mar': '🌊', 'Jardim': '🌿', 'Deck': '🪵' }
const typeLabels = { pool: 'Piscina', chacara: 'Chacara', gourmet: 'Espaco Gourmet', court: 'Quadra', soccer: 'Campo de Futebol', futevolei: 'Quadra de Futevolei' }

export default function PropertyDetail() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [property, setProperty] = useState(null)
  const [host, setHost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [imgIndex, setImgIndex] = useState(0)
  const [selectedDate, setSelectedDate] = useState('')
  const [guests, setGuests] = useState(1)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [isFav, setIsFav] = useState(false)

  useEffect(() => { fetchProperty() }, [id])

  async function fetchProperty() {
    const { data } = await supabase.from('properties').select('*').eq('id', id).single()
    if (!data) { navigate('/explorar'); return }
    setProperty(data)
    const { data: hostData } = await supabase.from('profiles').select('name, created_at').eq('id', data.host_id).single()
    setHost(hostData)
    setLoading(false)
  }

  async function handleBooking() {
    if (!user) { toast.error('Faca login para reservar!'); navigate('/entrar'); return }
    if (!selectedDate) { toast.error('Selecione uma data!'); return }
    if (guests < 1) { toast.error('Selecione o numero de convidados!'); return }

    const weekday = new Date(selectedDate + 'T00:00:00').getDay()
    if (property.available_days?.length && !property.available_days.includes(weekday)) {
      toast.error('O anfitriao nao atende nesse dia da semana.'); return
    }
    const { data: blocked } = await supabase.from('blocked_dates').select('id').eq('property_id', property.id).eq('date', selectedDate).maybeSingle()
    if (blocked) { toast.error('Essa data nao esta disponivel.'); return }
    const { data: existing } = await supabase.from('bookings').select('id').eq('property_id', property.id).eq('date', selectedDate).in('status', ['pending', 'confirmed']).maybeSingle()
    if (existing) { toast.error('Essa data ja foi reservada.'); return }

    setBookingLoading(true)
    try {
      const totalAmount = Number(property.price_per_day || property.price_per_hour)
      const platformFee = totalAmount * 0.15
      const hostAmount = totalAmount * 0.85
      const { data: booking, error } = await supabase.from('bookings').insert({
        property_id: property.id,
        host_id: property.host_id,
        client_id: user.id,
        date: selectedDate,
        guests,
        total_amount: totalAmount,
        platform_fee: platformFee,
        host_amount: hostAmount,
        status: 'pending',
      }).select().single()
      if (error) throw error
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, amount: totalAmount, title: property.name, email: profile?.email || user.email })
      })
      const { init_point } = await res.json()
      if (init_point) window.location.href = init_point
      else throw new Error('Erro ao criar pagamento')
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

  return (
    <div className="min-h-screen bg-white">
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
          <button onClick={() => setIsFav(!isFav)} className="bg-white/90 backdrop-blur-sm rounded-full p-2 hover:bg-white shadow">
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
              <button className="shrink-0 p-2 text-gray-400 hover:text-gray-600"><Share2 size={20}/></button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-4">
              <div className="flex items-center gap-1"><MapPin size={14}/>{property.city} — BR</div>
              <div className="flex items-center gap-1"><Users size={14}/>Ate {property.max_capacity} pessoas</div>
              <div className="flex items-center gap-1"><Clock size={14}/>Minimo {property.min_duration || 1} dia</div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {[
                { icon: <Users size={14}/>, label: `Ate ${property.max_capacity} pessoas` },
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
                  <p className="font-semibold text-gray-800 group-hover:text-primary-500 transition-colors">Anfitriao: {host?.name}</p>
                  <p className="text-xs text-gray-400">Ver perfil</p>
                </div>
              </Link>
            </div>

            {property.description && (
              <div className="border-t pt-5 mb-5">
                <h2 className="font-bold text-gray-800 mb-2">Sobre o espaco</h2>
                <p className="text-gray-600 text-sm leading-relaxed">{property.description}</p>
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
                <p className="text-gray-600 text-sm leading-relaxed">{property.rules}</p>
              </div>
            )}

            <div className="border-t pt-5">
              <h2 className="font-bold text-gray-800 mb-2">Localizacao aproximada</h2>
              <div className="flex items-center gap-2 text-gray-500 text-sm bg-gray-50 rounded-xl p-4">
                <MapPin size={16} className="text-primary-500"/>
                <span>{property.city} — BR</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">O endereco completo sera compartilhado apos a confirmacao da reserva.</p>
            </div>

            <div className="border-t pt-5 mt-5">
              <h2 className="font-bold text-gray-800 mb-3">Avaliacoes</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(s => <Star key={s} size={18} className="text-gray-200 fill-gray-200"/>)}
                </div>
                <p className="text-gray-500 text-sm">Nenhuma avaliacao ainda.</p>
              </div>
            </div>
          </div>

          {/* Booking Card */}
          <div className="lg:w-96 shrink-0">
            <div className="sticky top-20 border-2 border-gray-100 rounded-3xl p-6 shadow-xl">
              <div className="flex items-baseline gap-2 mb-5">
                <span className="text-2xl font-bold text-gray-800">R$ {totalAmount.toLocaleString('pt-BR')}</span>
                <span className="text-gray-500">/diaria</span>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Escolha a data</label>
                  <input type="date" min={today} className="input-field" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Convidados</label>
                  <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3">
                    <button onClick={() => setGuests(g => Math.max(1, g - 1))} className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-lg font-medium">−</button>
                    <span className="flex-1 text-center font-medium">{guests} pessoa{guests > 1 ? 's' : ''}</span>
                    <button onClick={() => setGuests(g => Math.min(property.max_capacity, g + 1))} className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-lg font-medium">+</button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Max. {property.max_capacity} pessoas</p>
                </div>
              </div>

              <button onClick={handleBooking} disabled={bookingLoading || !selectedDate} className="btn-primary w-full text-center mb-3">
                {bookingLoading ? 'Processando...' : 'Reservar agora'}
              </button>

              {selectedDate && (
                <div className="text-sm text-gray-600 space-y-1.5 pt-3 border-t">
                  <div className="flex justify-between"><span>R$ {totalAmount.toLocaleString('pt-BR')} x 1 dia</span><span>R$ {totalAmount.toLocaleString('pt-BR')}</span></div>
                  <div className="flex justify-between font-bold text-gray-800 pt-1 border-t"><span>Total</span><span>R$ {totalAmount.toLocaleString('pt-BR')}</span></div>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2">
                {[
                  { icon: <Shield size={14}/>, text: 'Pagamento 100% seguro' },
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
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex items-center justify-between lg:hidden">
        <div><span className="font-bold text-gray-800 text-lg">R$ {totalAmount.toLocaleString('pt-BR')}</span><span className="text-gray-500 text-sm">/diaria</span></div>
        <button onClick={handleBooking} disabled={bookingLoading || !selectedDate} className="btn-primary px-8 py-3 text-sm">
          {bookingLoading ? 'Aguarde...' : 'Reservar'}
        </button>
      </div>
    </div>
  )
}
