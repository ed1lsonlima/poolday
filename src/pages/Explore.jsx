import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PropertyCard from '../components/common/PropertyCard'
import { Search, SlidersHorizontal, X } from 'lucide-react'

const types = [
  { id: '', label: 'Todos os espaços', icon: '🌐' },
  { id: 'pool', label: 'Piscina', icon: '🏊' },
  { id: 'chacara', label: 'Chácara', icon: '🌿' },
  { id: 'gourmet', label: 'Espaço Gourmet', icon: '🍖' },
  { id: 'court', label: 'Quadra', icon: '🏀' },
  { id: 'soccer', label: 'Campo de Futebol', icon: '⚽' },
  { id: 'futevolei', label: 'Quadra de Futevôlei', icon: '🏐' },
]

export default function Explore() {
  const [params, setParams] = useSearchParams()
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    cidade: params.get('cidade') || '',
    tipo: params.get('tipo') || '',
    maxGuests: '',
    maxPrice: '',
  })

  useEffect(() => { fetchProperties() }, [params])

  async function fetchProperties() {
    setLoading(true)
    let query = supabase.from('properties').select('*').eq('is_active', true)
    if (params.get('cidade')) query = query.ilike('city', `%${params.get('cidade')}%`)
    if (params.get('tipo')) query = query.eq('type', params.get('tipo'))
    if (params.get('maxPrice')) query = query.lte('price_per_day', params.get('maxPrice'))
    const { data } = await query.order('created_at', { ascending: false })
    setProperties(data || [])
    setLoading(false)
  }

  function applyFilters(e) {
    e.preventDefault()
    const p = new URLSearchParams()
    if (filters.cidade) p.set('cidade', filters.cidade)
    if (filters.tipo) p.set('tipo', filters.tipo)
    if (filters.maxPrice) p.set('maxPrice', filters.maxPrice)
    setParams(p)
    setShowFilters(false)
  }

  function clearFilters() {
    setFilters({ cidade: '', tipo: '', maxGuests: '', maxPrice: '' })
    setParams({})
  }

  const hasFilters = params.toString() !== ''

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barra de busca */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200">
            <Search size={18} className="text-gray-400" />
            <input
              className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder:text-gray-400"
              placeholder="Buscar por cidade..."
              value={filters.cidade}
              onChange={e => setFilters({...filters, cidade: e.target.value})}
              onKeyDown={e => e.key === 'Enter' && applyFilters(e)}
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-medium text-sm transition-all ${showFilters ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            <SlidersHorizontal size={18} />
            <span className="hidden sm:inline">Filtros</span>
          </button>
        </div>

        {/* Tipos */}
        <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {types.map(t => (
            <button
              key={t.id}
              onClick={() => { setFilters({...filters, tipo: t.id}); const p = new URLSearchParams(params); if (t.id) p.set('tipo', t.id); else p.delete('tipo'); setParams(p) }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border-2 transition-all ${params.get('tipo') === t.id || (!t.id && !params.get('tipo')) ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Painel de filtros */}
        {showFilters && (
          <form onSubmit={applyFilters} className="max-w-6xl mx-auto px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-t pt-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Preço máx. (R$)</label>
              <input type="number" className="input-field text-sm" placeholder="Ex: 500" value={filters.maxPrice} onChange={e => setFilters({...filters, maxPrice: e.target.value})} />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="btn-primary py-2.5 flex-1 text-sm">Ver resultados</button>
              {hasFilters && <button type="button" onClick={clearFilters} className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50"><X size={16}/></button>}
            </div>
          </form>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {hasFilters && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-600 text-sm">{loading ? 'Buscando...' : `${properties.length} espaço(s) encontrado(s)`}</p>
            <button onClick={clearFilters} className="text-primary-500 text-sm font-medium hover:underline flex items-center gap-1"><X size={14}/>Limpar filtros</button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/3] bg-gray-200 rounded-2xl mb-3" />
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🏊</p>
            <h3 className="text-xl font-bold text-gray-700 mb-2">Nenhum espaço encontrado</h3>
            <p className="text-gray-500">Tente outros filtros ou outra cidade.</p>
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
