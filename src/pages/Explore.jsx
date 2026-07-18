import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PropertyCard from '../components/common/PropertyCard'
import { Search, SlidersHorizontal, X, Users, Waves } from 'lucide-react'

const types = [
  { id: '', label: 'Todos os espaços', icon: '🌐' },
  { id: 'pool', label: 'Piscina', icon: '🏊' },
  { id: 'chacara', label: 'Chácara', icon: '🌿' },
  { id: 'gourmet', label: 'Espaço Gourmet', icon: '🍖' },
  { id: 'court', label: 'Quadra', icon: '🏀' },
  { id: 'soccer', label: 'Campo de Futebol', icon: '⚽' },
  { id: 'futevolei', label: 'Quadra de Futevôlei', icon: '🏐' },
]

/* O card mostra a diária quando existe, senão o preço por hora.
   O filtro de preço tem que enxergar o MESMO número, senão o usuário
   filtra por "até R$ 200" e some um espaço de R$ 50/hora. */
function effectivePrice(p) {
  return Number(p.price_per_day) > 0 ? Number(p.price_per_day) : Number(p.price_per_hour) || 0
}

function PropertyCardSkeleton() {
  return (
    <div>
      <div className="skeleton aspect-[4/3] rounded-2xl mb-3" />
      <div className="skeleton h-4 w-3/4 rounded-md mb-2" />
      <div className="skeleton h-3 w-1/2 rounded-md mb-2" />
      <div className="skeleton h-4 w-1/3 rounded-md" />
    </div>
  )
}

export default function Explore() {
  const [params, setParams] = useSearchParams()
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  const [filters, setFilters] = useState({
    cidade: params.get('cidade') || '',
    tipo: params.get('tipo') || '',
    maxGuests: params.get('convidados') || '',
    maxPrice: params.get('maxPrice') || '',
  })

  // Guarda contra corrida: se o usuário troca o filtro rápido, a resposta
  // antiga pode chegar depois da nova e sobrescrever o resultado certo.
  const requestId = useRef(0)

  // Mantém os campos em sincronia quando a URL muda por fora
  // (voltar/avançar no navegador, link vindo da Home).
  useEffect(() => {
    setFilters({
      cidade: params.get('cidade') || '',
      tipo: params.get('tipo') || '',
      maxGuests: params.get('convidados') || '',
      maxPrice: params.get('maxPrice') || '',
    })
  }, [params])

  useEffect(() => {
    const id = ++requestId.current
    setLoading(true)

    let query = supabase.from('properties').select('*').eq('is_active', true)

    const cidade = params.get('cidade')
    const tipo = params.get('tipo')
    const convidados = Number(params.get('convidados'))

    if (cidade) query = query.ilike('city', `%${cidade}%`)
    if (tipo) query = query.eq('type', tipo)
    if (convidados > 0) query = query.gte('max_capacity', convidados)

    query.order('created_at', { ascending: false }).then(({ data }) => {
      if (id !== requestId.current) return // resposta velha, descarta

      let rows = data || []

      // Preço filtrado aqui e não no banco: a regra depende de qual dos dois
      // campos vale para cada espaço, e o volume atual não justifica SQL.
      const max = Number(params.get('maxPrice'))
      if (max > 0) rows = rows.filter(p => effectivePrice(p) <= max)

      setProperties(rows)
      setLoading(false)
    })
  }, [params])

  useEffect(() => {
    const cidade = params.get('cidade')
    document.title = cidade
      ? `Espaços em ${cidade} — PoolDay`
      : 'Explorar espaços — PoolDay'
  }, [params])

  function pushFilters(next) {
    const p = new URLSearchParams()
    if (next.cidade?.trim()) p.set('cidade', next.cidade.trim())
    if (next.tipo) p.set('tipo', next.tipo)
    if (next.maxGuests) p.set('convidados', next.maxGuests)
    if (next.maxPrice) p.set('maxPrice', next.maxPrice)
    setParams(p)
  }

  function applyFilters(e) {
    e.preventDefault()
    pushFilters(filters)
    setShowFilters(false)
  }

  function clearFilters() {
    setFilters({ cidade: '', tipo: '', maxGuests: '', maxPrice: '' })
    setParams(new URLSearchParams())
    setShowFilters(false)
  }

  const hasFilters = params.toString() !== ''
  const count = properties.length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barra de busca */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200 focus-within:border-primary-400 focus-within:bg-white transition-colors">
            <Search size={18} className="text-gray-400 shrink-0" />
            <input
              className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder:text-gray-400"
              placeholder="Buscar por cidade..."
              value={filters.cidade}
              onChange={e => setFilters({ ...filters, cidade: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && applyFilters(e)}
            />
            {filters.cidade && (
              <button
                type="button"
                onClick={() => { const next = { ...filters, cidade: '' }; setFilters(next); pushFilters(next) }}
                aria-label="Limpar cidade"
                className="text-gray-300 hover:text-gray-500 transition-colors shrink-0"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-medium text-sm transition-all active:scale-[0.97] ${showFilters ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
          >
            <SlidersHorizontal size={18} />
            <span className="hidden sm:inline">Filtros</span>
            {(filters.maxPrice || filters.maxGuests) && (
              <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-primary-500 rounded-full ring-2 ring-white" />
            )}
          </button>
        </div>

        {/* Tipos */}
        <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {types.map(t => {
            const active = params.get('tipo') === t.id || (!t.id && !params.get('tipo'))
            return (
              <button
                key={t.id}
                onClick={() => pushFilters({ ...filters, tipo: t.id })}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border-2 transition-all active:scale-[0.97] ${active ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            )
          })}
        </div>

        {/* Painel de filtros */}
        <div className={`accordion-body ${showFilters ? 'is-open' : ''} border-t border-gray-100`}>
          <div>
            <form onSubmit={applyFilters} className="max-w-6xl mx-auto px-4 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Preço máx. (R$)</label>
                <input
                  type="number" min="0" inputMode="numeric"
                  className="input-field text-sm"
                  placeholder="Ex: 500"
                  value={filters.maxPrice}
                  onChange={e => setFilters({ ...filters, maxPrice: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Convidados</label>
                <div className="relative">
                  <Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="number" min="1" inputMode="numeric"
                    className="input-field text-sm pl-9"
                    placeholder="Ex: 15"
                    value={filters.maxGuests}
                    onChange={e => setFilters({ ...filters, maxGuests: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <button type="submit" className="btn-primary py-2.5 flex-1 text-sm">Ver resultados</button>
                {hasFilters && (
                  <button
                    type="button" onClick={clearFilters}
                    aria-label="Limpar filtros"
                    className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors shrink-0"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {hasFilters && (
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-gray-600 text-sm">
              {loading ? 'Buscando...' : count === 1 ? '1 espaço encontrado' : `${count} espaços encontrados`}
            </p>
            <button onClick={clearFilters} className="text-primary-500 text-sm font-medium hover:underline flex items-center gap-1 shrink-0">
              <X size={14} />Limpar filtros
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => <PropertyCardSkeleton key={i} />)}
          </div>
        ) : count === 0 ? (
          /* Antes isso era um beco sem saída. Agora sempre sobra um caminho:
             afrouxar o filtro, ou virar anfitrião na cidade que ele buscou. */
          <div className="max-w-md mx-auto text-center py-16">
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Waves size={30} className="text-primary-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">Nenhum espaço encontrado</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              {params.get('cidade')
                ? `Ainda não temos espaços disponíveis em ${params.get('cidade')} com esses filtros.`
                : 'Tente ajustar os filtros para ver mais opções.'}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              {hasFilters && (
                <button onClick={clearFilters} className="btn-secondary text-sm py-2.5">
                  Ver todos os espaços
                </button>
              )}
              <Link to="/cadastro?role=host" className="btn-primary text-sm py-2.5 inline-flex items-center justify-center">
                Tenho um espaço para alugar
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {properties.map(p => <PropertyCard key={p.id} property={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
