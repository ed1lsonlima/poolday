import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Search, MapPin, Waves, Shield, Star, ChevronRight,
  CreditCard, MessageCircle, CheckCircle, DollarSign,
  Calendar, ChevronDown, FileText
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

const FAQS = [
  { q: 'Como funciona a reserva?', a: 'Busque o espaço ideal, escolha a data, selecione o número de convidados e finalize o pagamento pelo site. Rápido e seguro.' },
  { q: 'O que está incluído na reserva?', a: 'Cada anfitrião define o que está incluído no espaço. Veja as comodidades na página do espaço antes de reservar.' },
  { q: 'Quantas pessoas posso levar?', a: 'Cada espaço tem uma capacidade máxima definida pelo anfitrião. Você pode verificar isso na página do espaço.' },
  { q: 'Terei acesso a banheiro?', a: 'Isso depende de cada espaço. Verifique a descrição e as comodidades listadas na página do espaço.' },
  { q: 'O anfitrião estará presente durante a reserva?', a: 'Depende do anfitrião. Você pode verificar isso nas instruções de check-in ou perguntar diretamente ao anfitrião.' },
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

/* ── Bolhas que sobem do fundo ───────────────────────────── */
const RISING_BUBBLES = [
  { size: 18, left: '6%',  duration: 13, delay: -2,  opacity: 0.35, drift: '10px' },
  { size: 34, left: '16%', duration: 18, delay: -9,  opacity: 0.25, drift: '-18px' },
  { size: 12, left: '27%', duration: 10, delay: -4,  opacity: 0.45, drift: '8px' },
  { size: 46, left: '38%', duration: 22, delay: -14, opacity: 0.18, drift: '-14px' },
  { size: 20, left: '50%', duration: 15, delay: -6,  opacity: 0.35, drift: '16px' },
  { size: 60, left: '62%', duration: 25, delay: -18, opacity: 0.15, drift: '-22px' },
  { size: 15, left: '73%', duration: 11, delay: -1,  opacity: 0.4,  drift: '12px' },
  { size: 30, left: '83%', duration: 17, delay: -10, opacity: 0.28, drift: '-10px' },
  { size: 22, left: '92%', duration: 14, delay: -7,  opacity: 0.3,  drift: '14px' },
]

/* ── Bolhas espalhadas por todo o hero, vagando sem rumo ───
   Quase transparentes (0.04–0.15). O brilho pulsa fora de fase
   com o movimento, então nenhuma bolha repete a mesma trajetória. */
const FLOATING_BUBBLES = [
  // topo
  { size: 10, top: '6%',  left: '8%',  duration: 14, delay: -3,  opacity: 0.10, dx: '16px',  dy: '-22px' },
  { size: 22, top: '11%', left: '22%', duration: 19, delay: -8,  opacity: 0.07, dx: '-20px', dy: '18px'  },
  { size: 7,  top: '5%',  left: '38%', duration: 12, delay: -5,  opacity: 0.14, dx: '12px',  dy: '20px'  },
  { size: 34, top: '9%',  left: '54%', duration: 24, delay: -12, opacity: 0.05, dx: '-14px', dy: '-26px' },
  { size: 13, top: '16%', left: '69%', duration: 16, delay: -2,  opacity: 0.11, dx: '22px',  dy: '14px'  },
  { size: 18, top: '7%',  left: '86%', duration: 21, delay: -14, opacity: 0.08, dx: '-18px', dy: '24px'  },
  { size: 9,  top: '20%', left: '94%', duration: 13, delay: -6,  opacity: 0.12, dx: '-12px', dy: '-16px' },
  { size: 26, top: '23%', left: '4%',  duration: 22, delay: -10, opacity: 0.06, dx: '18px',  dy: '20px'  },
  // meio
  { size: 12, top: '34%', left: '15%', duration: 15, delay: -4,  opacity: 0.11, dx: '-16px', dy: '22px'  },
  { size: 40, top: '30%', left: '33%', duration: 26, delay: -16, opacity: 0.04, dx: '20px',  dy: '-18px' },
  { size: 8,  top: '41%', left: '48%', duration: 11, delay: -7,  opacity: 0.13, dx: '14px',  dy: '18px'  },
  { size: 20, top: '37%', left: '63%', duration: 20, delay: -11, opacity: 0.07, dx: '-22px', dy: '-20px' },
  { size: 15, top: '46%', left: '79%', duration: 17, delay: -1,  opacity: 0.10, dx: '16px',  dy: '24px'  },
  { size: 30, top: '52%', left: '90%', duration: 23, delay: -13, opacity: 0.05, dx: '-16px', dy: '-22px' },
  { size: 11, top: '55%', left: '9%',  duration: 14, delay: -9,  opacity: 0.12, dx: '20px',  dy: '-18px' },
  { size: 24, top: '49%', left: '26%', duration: 25, delay: -18, opacity: 0.06, dx: '-18px', dy: '16px'  },
  { size: 6,  top: '58%', left: '43%', duration: 10, delay: -3,  opacity: 0.15, dx: '12px',  dy: '-14px' },
  { size: 17, top: '61%', left: '58%', duration: 18, delay: -15, opacity: 0.09, dx: '-20px', dy: '20px'  },
  // base
  { size: 13, top: '68%', left: '73%', duration: 16, delay: -5,  opacity: 0.11, dx: '18px',  dy: '16px'  },
  { size: 36, top: '72%', left: '12%', duration: 27, delay: -20, opacity: 0.04, dx: '-14px', dy: '-24px' },
  { size: 9,  top: '78%', left: '36%', duration: 12, delay: -8,  opacity: 0.13, dx: '16px',  dy: '18px'  },
  { size: 21, top: '83%', left: '52%', duration: 21, delay: -2,  opacity: 0.07, dx: '-20px', dy: '-16px' },
  { size: 14, top: '75%', left: '85%', duration: 15, delay: -11, opacity: 0.10, dx: '14px',  dy: '22px'  },
  { size: 28, top: '88%', left: '66%', duration: 24, delay: -17, opacity: 0.05, dx: '-16px', dy: '-20px' },
  { size: 8,  top: '92%', left: '20%', duration: 13, delay: -6,  opacity: 0.13, dx: '18px',  dy: '-16px' },
]

function HeroBubbles() {
  return (
    <div className="hero-bubbles" aria-hidden="true">
      {FLOATING_BUBBLES.map((b, i) => (
        <span
          key={`f${i}`}
          className="bubble-float"
          style={{
            width: b.size, height: b.size, top: b.top, left: b.left,
            animationDuration: `${b.duration}s, ${b.duration * 0.66}s`,
            animationDelay: `${b.delay}s, ${b.delay * 0.5}s`,
            '--bubble-opacity': b.opacity,
            '--dx': b.dx,
            '--dy': b.dy,
          }}
        />
      ))}
      {RISING_BUBBLES.map((b, i) => (
        <span
          key={`r${i}`}
          className="bubble"
          style={{
            width: b.size, height: b.size, left: b.left,
            animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s`,
            '--bubble-opacity': b.opacity, '--bubble-drift': b.drift,
          }}
        />
      ))}
    </div>
  )
}

/* Revela o bloco quando ele entra na tela. Observa uma vez e desliga —
   sem listener de scroll, sem custo depois que apareceu. */
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setVisible(true); io.disconnect() }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`border rounded-2xl overflow-hidden transition-colors duration-200 ${open ? 'border-primary-200 bg-primary-50/30' : 'border-gray-200'}`}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-gray-800 hover:bg-gray-50/70 transition-colors"
      >
        <span>{q}</span>
        <ChevronDown size={18} className={`text-gray-400 transition-transform duration-300 shrink-0 ml-3 ${open ? 'rotate-180 text-primary-500' : ''}`} />
      </button>
      <div className={`accordion-body ${open ? 'is-open' : ''}`}>
        <div>
          <div className="px-5 pb-4 text-gray-500 text-sm leading-relaxed border-t border-gray-100 pt-3">{a}</div>
        </div>
      </div>
    </div>
  )
}

function PropertyCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="skeleton h-40 w-full" />
      <div className="p-4 space-y-2.5">
        <div className="skeleton h-4 w-3/4 rounded-md" />
        <div className="skeleton h-3 w-1/2 rounded-md" />
        <div className="skeleton h-5 w-1/3 rounded-md mt-3" />
      </div>
    </div>
  )
}

function initialsOf(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || '?'
}

export default function Home() {
  const [city, setCity]       = useState('')
  const [typeIdx, setTypeIdx] = useState(0)
  const [typeOpen, setTypeOpen] = useState(false)
  const [featured, setFeatured] = useState([])
  const [loadingFeatured, setLoadingFeatured] = useState(true)
  const [reviews, setReviews] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('properties').select('*').eq('is_active', true)
      .order('created_at', { ascending: false }).limit(4)
      .then(({ data }) => { setFeatured(data || []); setLoadingFeatured(false) })
  }, [])

  // Avaliações REAIS do banco. Se não houver nenhuma, a seção some.
  useEffect(() => {
    supabase
      .from('reviews')
      .select('id, rating, comment, created_at, reviewer:profiles!reviewer_id(name, city), property:properties!property_id(name, city)')
      .not('comment', 'is', null)
      .neq('comment', '')
      .gte('rating', 4)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data, error }) => {
        if (error) { setReviews([]); return }
        setReviews(data || [])
      })
  }, [])

  // Fecha o dropdown com ESC
  useEffect(() => {
    if (!typeOpen) return
    const onKey = e => { if (e.key === 'Escape') setTypeOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [typeOpen])

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
          <HeroBubbles />
        </div>

        <div className="relative max-w-xl mx-auto text-center">
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-3">
            Encontre a piscina perfeita<br/>para o seu dia
          </h1>
          <p className="text-white/80 text-base mb-8">
            Reserve por horas ou diária, com segurança e sem complicação.
          </p>

          <form onSubmit={handleSearch} className="bg-white/95 backdrop-blur rounded-3xl shadow-[0_20px_60px_-15px_rgba(11,63,114,0.45)] ring-1 ring-white/40 text-left">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 rounded-t-3xl transition-colors focus-within:bg-primary-50/40">
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
                aria-expanded={typeOpen}
                aria-haspopup="listbox"
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
                  <div className="fixed inset-0 z-40 bg-primary-900/20 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-0" onClick={() => setTypeOpen(false)} />
                  {/* Celular: painel sobe da base. Desktop: abre ancorado no campo. */}
                  <div
                    role="listbox"
                    className="sheet-panel fixed left-4 right-4 bottom-4 bg-white border border-gray-200 shadow-2xl z-50 rounded-3xl py-2 max-w-xl mx-auto
                               sm:dropdown-panel sm:absolute sm:left-0 sm:right-0 sm:bottom-auto sm:top-full sm:mt-2 sm:rounded-2xl sm:max-w-none"
                  >
                    <div className="px-4 py-2 border-b border-gray-100 mb-1">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Selecione o tipo de espaço</p>
                    </div>
                    {SPACE_TYPES.map((t, i) => (
                      <button
                        key={t.id}
                        type="button"
                        role="option"
                        aria-selected={typeIdx === i}
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
            className="mt-4 flex items-center gap-2 mx-auto text-white/80 hover:text-white text-sm transition-all bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full active:scale-95"
          >
            <MapPin size={15} />
            <span>Usar minha localização</span>
          </button>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-white/70 text-xs">
            <span className="flex items-center gap-1.5"><CreditCard size={13}/> Pagamento 100% seguro</span>
            <span className="flex items-center gap-1.5"><Shield size={13}/> Reserva garantida</span>
            <span className="flex items-center gap-1.5"><Calendar size={13}/> Data confirmada na hora</span>
          </div>
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-4 py-12">
        <Reveal>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-extrabold text-gray-800">Explore por categoria</h2>
            <p className="text-gray-500 mt-1">Encontre o tipo de espaço ideal para o seu evento</p>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-4">
          {CATEGORIES.map((cat, i) => (
            <Reveal key={cat.id} delay={i * 60}>
              <button
                onClick={() => navigate(`/explorar?tipo=${cat.id}`)}
                className="group w-full flex flex-col items-center justify-center gap-3 p-6 bg-white border-2 border-gray-100 rounded-3xl hover:border-primary-400 hover:bg-primary-50 hover:shadow-lg hover:-translate-y-1 active:scale-[0.97] active:translate-y-0 transition-all duration-200"
              >
                <span className="text-4xl transition-transform duration-200 group-hover:scale-110">{cat.emoji}</span>
                <span className="font-bold text-gray-700 group-hover:text-primary-600 text-sm">{cat.label}</span>
              </button>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Reveal>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-800">Espaços em destaque</h2>
                <p className="text-gray-500 text-sm mt-0.5">Confira alguns dos espaços disponíveis</p>
              </div>
              <Link to="/explorar" className="text-primary-500 text-sm font-semibold hover:underline flex items-center gap-1 group">
                Ver todos <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5"/>
              </Link>
            </div>
          </Reveal>

          <div className="space-y-4">
            {loadingFeatured ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PropertyCardSkeleton />
                <PropertyCardSkeleton />
              </div>
            ) : featured.length === 0 ? (
              <Reveal>
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
              </Reveal>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {featured.map((p, i) => (
                  <Reveal key={p.id} delay={i * 70}>
                    <PropertyCard property={p} />
                  </Reveal>
                ))}
              </div>
            )}
          </div>

          <Reveal>
            <div className="mt-6 text-center">
              <Link to="/explorar" className="btn-secondary inline-flex items-center gap-2 text-sm">
                Ver todos os espaços <ChevronRight size={16}/>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-4 py-14">
        <Reveal>
          <div className="text-center mb-10">
            <h2 className="text-2xl font-extrabold text-gray-800">Como funciona</h2>
            <p className="text-gray-500 mt-1">Em 3 passos simples</p>
          </div>
        </Reveal>
        <div className="space-y-5">
          {[
            { icon: <Search size={26} className="text-primary-500"/>, title: 'Encontre', desc: 'Busque piscinas e espaços incríveis na sua cidade com filtros inteligentes.' },
            { icon: <Calendar size={26} className="text-primary-500"/>, title: 'Reserve', desc: 'Escolha data, horário e faça sua reserva com pagamento seguro.' },
            { icon: <Waves size={26} className="text-primary-500"/>, title: 'Aproveite', desc: 'Curta seu dia de piscina com amigos e família. Diversão garantida!' },
          ].map((step, i) => (
            <Reveal key={i} delay={i * 90}>
              <div className="flex items-start gap-5 bg-gray-50 rounded-3xl p-5 hover:bg-primary-50/50 transition-colors duration-200">
                <div className="relative w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center shrink-0">
                  {step.icon}
                  <span className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-primary-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                    {i + 1}
                  </span>
                </div>
                <div className="pt-1">
                  <h3 className="font-bold text-gray-800 text-lg">{step.title}</h3>
                  <p className="text-gray-500 text-sm mt-1 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 py-14 px-4">
        <div className="max-w-2xl mx-auto">
          <Reveal>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-extrabold text-gray-800">Reserve com total segurança</h2>
              <p className="text-gray-500 mt-1">Sua experiência é protegida do início ao fim</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 gap-4">
            {[
              { icon: <CreditCard size={26} className="text-primary-500"/>, title: 'Pagamento 100% seguro', desc: 'Transações protegidas via Mercado Pago' },
              { icon: <Shield size={26} className="text-primary-500"/>, title: 'Reserva garantida', desc: 'A data fica travada assim que o pagamento é confirmado' },
              { icon: <FileText size={26} className="text-primary-500"/>, title: 'Regras claras', desc: 'Você vê as regras e o que está incluído antes de pagar' },
              { icon: <CheckCircle size={26} className="text-primary-500"/>, title: 'Cancelamento transparente', desc: 'Política de cancelamento disponível no site' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 70}>
                <div className="bg-white rounded-3xl p-5 flex items-center gap-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-primary-100 transition-all duration-200">
                  <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{item.title}</h3>
                    <p className="text-gray-500 text-sm mt-0.5">{item.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 to-blue-400 py-14 px-4">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-xl mx-auto text-white">
          <Reveal>
            <h2 className="text-3xl font-extrabold leading-tight mb-3">
              Tem uma piscina?<br/>Ganhe dinheiro com ela!
            </h2>
            <p className="text-white/80 mb-8 text-base leading-relaxed">
              Cadastre seu espaço gratuitamente e comece a receber reservas. Você define o preço, escolhe os dias e aprova cada reserva antes.
            </p>
            <Link
              to="/cadastro?role=host"
              className="inline-flex items-center gap-2 bg-white text-primary-600 font-bold px-7 py-3.5 rounded-2xl hover:bg-gray-50 hover:gap-3 active:scale-[0.97] transition-all text-base shadow-lg group"
            >
              Anuncie grátis <ChevronRight size={20}/>
            </Link>
          </Reveal>

          <div className="mt-8 grid grid-cols-1 gap-3">
            {[
              { icon: <DollarSign size={22}/>, title: 'Ganhe dinheiro', desc: 'Transforme sua piscina em uma fonte de renda extra.' },
              { icon: <Calendar size={22}/>, title: 'Você define o horário', desc: 'Controle total sobre disponibilidade e preços.' },
              { icon: <Shield size={22}/>, title: 'Pagamento seguro', desc: 'Receba diretamente na sua conta com segurança.' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="flex items-center gap-4 bg-white/15 hover:bg-white/25 rounded-2xl px-4 py-3.5 transition-colors duration-200">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">{item.title}</p>
                    <p className="text-white/70 text-xs mt-0.5">{item.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Avaliações REAIS — a seção só existe se houver avaliação no banco */}
      {reviews.length > 0 && (
        <section className="py-14 px-4">
          <div className="max-w-2xl mx-auto">
            <Reveal>
              <div className="text-center mb-8">
                <span className="inline-block bg-primary-50 text-primary-600 text-xs font-bold px-4 py-1.5 rounded-full mb-3">Avaliações reais</span>
                <h2 className="text-2xl font-extrabold text-gray-800">O que estão falando do PoolDay</h2>
                <p className="text-gray-500 mt-1 text-sm">Avaliações de quem reservou e usou o espaço.</p>
              </div>
            </Reveal>
            <div className="space-y-4">
              {reviews.map((r, i) => (
                <Reveal key={r.id} delay={i * 70}>
                  <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
                    <div className="flex items-center gap-0.5 mb-3">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star
                          key={s}
                          size={15}
                          className={s < (r.rating || 0) ? 'text-orange-500 fill-orange-500' : 'text-gray-200 fill-gray-200'}
                        />
                      ))}
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed mb-4">"{r.comment}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {initialsOf(r.reviewer?.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{r.reviewer?.name || 'Cliente PoolDay'}</p>
                        <p className="text-gray-400 text-xs truncate">
                          {r.property?.name}
                          {r.property?.city ? ` · ${r.property.city}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-gray-50 py-14 px-4">
        <div className="max-w-2xl mx-auto">
          <Reveal>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-extrabold text-gray-800">Perguntas Frequentes</h2>
              <p className="text-gray-500 mt-1 text-sm">Tudo o que você precisa saber sobre reservas de espaços no PoolDay.</p>
            </div>
          </Reveal>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <Reveal key={i} delay={Math.min(i, 4) * 50}>
                <FaqItem {...faq} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
