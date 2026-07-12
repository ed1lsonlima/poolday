import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Search, MapPin, Waves, Shield, Star, ChevronRight,
  CreditCard, MessageCircle, CheckCircle, DollarSign,
  Calendar, ChevronDown, Users
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import PropertyCard from '../components/common/PropertyCard'

const CATEGORIES = [
  { id: 'pool',      label: 'Piscina',             emoji: '🏊' },
  { id: 'chacara',   label: 'Chácara',             emoji: '🌿' },
  { id: 'gourmet',   label: 'Espaço Gourmet',      emoji: '🍖' },
  { id: 'court',     label: 'Quadra',              emoji: '🏀' },
  { id: 'soccer',    label: 'Campo de Futebol',    emoji: '⚽' },
  { id: 'futevolei', label: 'Quadra de Futevôlei', emoji: '🏐' },
]

const TESTIMONIALS = [
  { text: 'Reservei uma piscina em Maceió pelo PoolDay e foi tudo perfeito. Processo super simples e o lugar era exatamente como nas fotos.', name: 'Juliana Souza', location: 'Maceió - AL', initials: 'JS', color: 'bg-pink-400' },
  { text: 'Usei o PoolDay pra comemorar o aniversário do meu filho. Muito mais barato que alugar salão e foi uma experiência incrível.', name: 'Carlos Henrique', location: 'Recife - PE', initials: 'CH', color: 'bg-blue-400' },
  { text: 'Fiquei com receio no começo, mas a plataforma é segura e o anfitrião respondeu rápido. Já usei duas vezes.', name: 'Fernanda Lima', location: 'São Paulo - SP', initials: 'FL', color: 'bg-purple-400' },
  { text: 'Coloquei minha piscina no PoolDay e já recebi várias reservas. Está gerando uma renda extra todo mês.', name: 'Ricardo Alves', location: 'Anfitrião - RJ', initials: 'RA', color: 'bg-green-400' },
  { text: 'Muito fácil de usar. Em poucos minutos consegui encontrar uma piscina perto de mim e fazer a reserva.', name: 'Amanda Rocha', location: 'Salvador - BA', initials: 'AR', color: 'bg-orange-400' },
  { text: 'O que mais gostei foi a segurança. Todo o pagamento é feito pela plataforma, sem risco.', name: 'Lucas Martins', location: 'Fortaleza - CE', initials: 'LM', color: 'bg-red-400' },
]

const FAQS = [
  { q: 'Como funciona a reserva?', a: 'Busque o espaço ideal, escolha a data, selecione o número de convidados e finalize o pagamento pelo site. Rápido e seguro.' },
  { q: 'O que está incluído na reserva?', a: 'Cada anfitrião define o que está incluído no espaço. Veja as comodidades na página do espaço antes de reservar.' },
  { q: 'Quantas pessoas posso levar?', a: 'Cada espaço tem uma capacidade máxima definida pelo anfitrião. Você pode verificar isso na página do espaço.' },
  { q: 'Terei acesso a banheiro?', a: 'Isso depende de cada espaço. Verifique a descrição e as comodidades listadas na página do espaço.' },
  { q: 'O anfitrião estará presente durante a reserva?', a: 'Depende do anfitrião. Você pode verificar isso nas instruções de check-in ou perguntar diretamente pelo chat.' },
  { q: 'O que acontece se o tempo estiver ruim?', a: 'Consulte nossa Política de Cancelamento. Em casos de força maior, trabalhamos para encontrar a melhor solução.' },
  { q: 'Posso levar comida e bebida?', a: 'Sim, na maioria dos espaços. Mas verifique as regras da casa de cada anfitrião antes da reserva.' },
  { q: 'Posso fazer uma festa ou evento?', a: 'Muitos espaços permitem. Verifique as regras do espaço específico e entre em contato com o anfitrião se tiver dúvidas.' },
  { q: 'Como os anfitriões recebem o pagamento?', a: 'O pagamento é processado com segurança pelo Mercado Pago. Os anfitriões recebem automaticamente após a confirmação da reserva.' },
]

const SPACE_TYPES = [
  { id: '',           label: 'Todos os espaços',     emoji: '🌐' },
  { id: 'pool',       label: 'Piscina',              emoji: '🏊' },
  { id: 'chacara',    label: 'Chácara',              emoji: '🌿' },
  { id: 'gourmet',    label: 'Espaço Gourmet',       emoji: '🍖' },
  { id: 'court',      label: 'Quadra',               emoji: '🏀' },
  { id: 'soccer',     label: 'Campo de Futebol',     emoji: '⚽' },
  { id: 'futevolei',  label: 'Quadra de Futevôlei',  emoji: '🏐' },
]

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
      >
        <span>{q}</span>
        <ChevronDown size={18} className={`text-gray-400 transition-transform shrink-0 ml-3 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-4 text-gray-500 text-sm leading-relaxed border-t border-gray-100 pt-3">{a}</div>}
    </div>
  )
}

export default function Home() {
  const [city, setCity]       = useState('')
  const [typeIdx, setTypeIdx] = useState(0)
  const [typeOpen, setTypeOpen] = useState(false)
  const [featured, setFeatured] = useState([])
  const [loadingFeatured, setLoadingFeatured] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('properties').select('*').eq('is_active', true)
      .order('created_at', { ascending: false }).limit(4)
      .then(({ data }) => { setFeatured(data || []); setLoadingFeatured(false) })
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (city.trim()) params.set('cidade', city.trim())
    if (SPACE_TYPES[typeIdx].id) params.set('tipo', SPACE_TYPES[typeIdx].id)
    navigate(`/explorar?${params.toString()}`)
  }

  function handleLocation() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(() => {
      navigate('/explorar')
    })
  }

  return (
    <div className="min-h-screen bg-white">

      <section className="relative bg-gradient-to-br from-primary-600 via-primary-500 to-blue-400 pt-14 pb-20 px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />

          <div className="hero-bubbles" aria-hidden="true">
            {[
              { size: 18, left: '6%',  duration: 13, delay: -2,  opacity: 0.35, drift: '10px' },
              { size: 34, left: '16%', duration: 18, delay: -9,  opacity: 0.25, drift: '-18px' },
              { size: 12, left: '27%', duration: 10, delay: -4,  opacity: 0.45, drift: '8px' },
              { size: 46, left: '38%', duration: 22, delay: -14, opacity: 0.18, drift: '-14px' },
              { size: 20, left: '50%', duration: 15, delay: -6,  opacity: 0.35, drift: '16px' },
              { size: 60, left: '62%', duration: 25, delay: -18, opacity: 0.15, drift: '-22px' },
              { size: 15, left: '73%', duration: 11, delay: -1,  opacity: 0.4,  drift: '12px' },
              { size: 30, left: '83%', duration: 17, delay: -10, opacity: 0.28, drift: '-10px' },
              { size: 22, left: '92%', duration: 14, delay: -7,  opacity: 0.3,  drift: '14px' },
            ].map((b, i) => (
              <span
                key={i}
                className="bubble"
                style={{
                  width: b.size, height: b.size, left: b.left,
                  animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s`,
                  '--bubble-opacity': b.opacity, '--bubble-drift': b.drift,
                }}
              />
            ))}
          </div>
        </div>

        <div className="relative max-w-xl mx-auto text-center">
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-3">
            Encontre a piscina perfeita<br/>para o seu dia
          </h1>
          <p className="text-white/80 text-base mb-8">
            Reserve por horas ou diária, com segurança e sem complicação.
          </p>

          <form onSubmit={handleSearch} className="bg-white/95 backdrop-blur rounded-3xl shadow-[0_20px_60px_-15px_rgba(11,63,114,0.45)] ring-1 ring-white/40 text-left">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 rounded-t-3xl">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl flex items-center justify-center shrink-0">
                <MapPin size={18} className="text-primary-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Qual cidade?</p>
                <input
                  className="w-full text-base text-gray-800 outline-none mt-0.5 placeholder:text-gray-400 placeholder:font-normal bg-transparent"
                  placeholder="Digite a cidade"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                />
              </div>
              <Search size={18} className="text-gray-300 shrink-0" />
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setTypeOpen(!typeOpen)}
                className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-primary-50/40 transition-colors"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl flex items-center justify-center shrink-0 text-lg">
                  {SPACE_TYPES[typeIdx].emoji}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Tipo de espaço</p>
                  <p className="text-base text-gray-800 mt-0.5 font-medium">{SPACE_TYPES[typeIdx].label}</p>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 shrink-0 ${typeOpen ? 'rotate-180' : ''}`} />
              </button>
              {typeOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setTypeOpen(false)} />
                  <div className="fixed left-4 right-4 bottom-4 bg-white border border-gray-200 shadow-2xl z-50 rounded-3xl py-2 max-w-xl mx-auto">
                    <div className="px-4 py-2 border-b border-gray-100 mb-1">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Selecione o tipo de espaço</p>
                    </div>
                    {SPACE_TYPES.map((t, i) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setTypeIdx(i); setTypeOpen(false) }}
                        className={`w-full flex items-center gap-3 text-left px-4 py-3 text-sm transition-colors ${typeIdx === i ? 'bg-primary-50 text-primary-600 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        <span className="text-lg">{t.emoji}</span>
                        <span className="flex-1">{t.label}</span>
                        {typeIdx === i && <CheckCircle size={15} className="text-primary-500 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="px-4 py-4 rounded-b-3xl">
              <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 shadow-lg shadow-primary-500/30 hover:shadow-primary-600/40 transition-shadow">
                <Search size={18} />
                <span className="font-bold">Buscar</span>
              </button>
            </div>
          </form>

          <button
            onClick={handleLocation}
            className="mt-4 flex items-center gap-2 mx-auto text-white/80 hover:text-white text-sm transition-colors bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full"
          >
            <MapPin size={15} />
            <span>Usar minha localização</span>
          </button>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-white/70 text-xs">
            <span className="flex items-center gap-1.5"><CreditCard size={13}/> Pagamento 100% seguro</span>
            <span className="flex items-center gap-1.5"><Shield size={13}/> Reserva garantida</span>
            <span className="flex items-center gap-1.5"><MessageCircle size={13}/> Comunicação segura</span>
          </div>
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-extrabold text-gray-800">Explore por categoria</h2>
          <p className="text-gray-500 mt-1">Encontre o tipo de espaço ideal para o seu evento</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => navigate(`/explorar?tipo=${cat.id}`)}
              className="group flex flex-col items-center justify-center gap-3 p-6 bg-white border-2 border-gray-100 rounded-3xl hover:border-primary-400 hover:bg-primary-50 hover:shadow-md transition-all duration-200"
            >
              <span className="text-4xl">{cat.emoji}</span>
              <span className="font-bold text-gray-700 group-hover:text-primary-600 text-sm">{cat.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-800">Espaços em destaque</h2>
              <p className="text-gray-500 text-sm mt-0.5">Confira alguns dos espaços disponíveis</p>
            </div>
            <Link to="/explorar" className="text-primary-500 text-sm font-semibold hover:underline flex items-center gap-1">
              Ver todos <ChevronRight size={16}/>
            </Link>
          </div>

          <div className="space-y-4">
            {loadingFeatured ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : featured.length === 0 ? (
              <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-6 flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center">
                  <Waves size={28} className="text-primary-400" />
                </div>
                <p className="font-semibold text-gray-600">Seja o primeiro a cadastrar seu espaço!</p>
                <p className="text-gray-400 text-sm">Os espaços aparecerão aqui conforme forem cadastrados.</p>
                <Link to="/cadastro?role=host" className="btn-primary text-sm px-5 py-2.5 mt-1">
                  Cadastrar meu espaço
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {featured.map(p => <PropertyCard key={p.id} property={p} />)}
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <Link to="/explorar" className="btn-secondary inline-flex items-center gap-2 text-sm">
              Ver todos os espaços <ChevronRight size={16}/>
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-4 py-14">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-extrabold text-gray-800">Como funciona</h2>
          <p className="text-gray-500 mt-1">Em 3 passos simples</p>
        </div>
        <div className="space-y-5">
          {[
            { icon: <Search size={26} className="text-primary-500"/>, title: 'Encontre', desc: 'Busque piscinas e espaços incríveis na sua cidade com filtros inteligentes.' },
            { icon: <Calendar size={26} className="text-primary-500"/>, title: 'Reserve', desc: 'Escolha data, horário e faça sua reserva com pagamento seguro.' },
            { icon: <Waves size={26} className="text-primary-500"/>, title: 'Aproveite', desc: 'Curta seu dia de piscina com amigos e família. Diversão garantida!' },
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-5 bg-gray-50 rounded-3xl p-5">
              <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center shrink-0">
                {step.icon}
              </div>
              <div className="pt-1">
                <h3 className="font-bold text-gray-800 text-lg">{step.title}</h3>
                <p className="text-gray-500 text-sm mt-1 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 py-14 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-extrabold text-gray-800">Reserve com total segurança</h2>
            <p className="text-gray-500 mt-1">Sua experiência é protegida do início ao fim</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {[
              { icon: <CreditCard size={26} className="text-primary-500"/>, title: 'Pagamento 100% seguro', desc: 'Transações protegidas via Mercado Pago' },
              { icon: <Shield size={26} className="text-primary-500"/>, title: 'Reserva garantida', desc: 'Sua reserva é protegida pela plataforma' },
              { icon: <MessageCircle size={26} className="text-primary-500"/>, title: 'Comunicação segura', desc: 'Converse com o anfitrião dentro do site' },
              { icon: <CheckCircle size={26} className="text-primary-500"/>, title: 'Anfitriões verificados', desc: 'Perfis e espaços revisados pela equipe' },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-3xl p-5 flex items-center gap-4 shadow-sm border border-gray-100">
                <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center shrink-0">
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{item.title}</h3>
                  <p className="text-gray-500 text-sm mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-primary-600 to-blue-400 py-14 px-4">
        <div className="max-w-xl mx-auto text-white">
          <h2 className="text-3xl font-extrabold leading-tight mb-3">
            Tem uma piscina?<br/>Ganhe dinheiro com ela!
          </h2>
          <p className="text-white/80 mb-8 text-base leading-relaxed">
            Cadastre seu espaço gratuitamente e comece a receber reservas hoje mesmo. Milhares de pessoas estão procurando piscinas na sua região.
          </p>
          <Link
            to="/cadastro?role=host"
            className="inline-flex items-center gap-2 bg-white text-primary-600 font-bold px-7 py-3.5 rounded-2xl hover:bg-gray-50 transition-colors text-base shadow-lg"
          >
            Anuncie grátis <ChevronRight size={20}/>
          </Link>

          <div className="mt-8 grid grid-cols-1 gap-3">
            {[
              { icon: <DollarSign size={22}/>, title: 'Ganhe dinheiro', desc: 'Transforme sua piscina em uma fonte de renda extra.' },
              { icon: <Calendar size={22}/>, title: 'Você define o horário', desc: 'Controle total sobre disponibilidade e preços.' },
              { icon: <Shield size={22}/>, title: 'Pagamento seguro', desc: 'Receba diretamente na sua conta com segurança.' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/15 rounded-2xl px-4 py-3.5">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                  {item.icon}
                </div>
                <div>
                  <p className="font-bold text-white text-sm">{item.title}</p>
                  <p className="text-white/70 text-xs mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block bg-primary-50 text-primary-600 text-xs font-bold px-4 py-1.5 rounded-full mb-3">Avaliações reais</span>
            <h2 className="text-2xl font-extrabold text-gray-800">O que estão falando do PoolDay</h2>
            <p className="text-gray-500 mt-1 text-sm">Pessoas reais alugando piscinas com segurança em todo o Brasil.</p>
          </div>
          <div className="space-y-4">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
                <p className="text-gray-600 text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${t.color} rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{t.name}</p>
                    <p className="text-gray-400 text-xs">{t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-14 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-extrabold text-gray-800">Perguntas Frequentes</h2>
            <p className="text-gray-500 mt-1 text-sm">Tudo o que você precisa saber sobre reservas de piscinas no PoolDay.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => <FaqItem key={i} {...faq} />)}
          </div>
        </div>
      </section>

    </div>
  )
}
