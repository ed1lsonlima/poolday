import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { filterCities } from '../../lib/citySearch'
export const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const cache = new Map()
export default function CityField({ value, onChange, required = false, label = 'Localização', description = 'Usada em relatórios regionais agregados. Não coletamos sua localização exata.' }) {
  const [cities, setCities] = useState([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef(null)
  const results = filterCities(cities, query)
  function chooseCity(city) {
    onChange({ state: value.state, city: city.nome, municipality_code: String(city.id) })
    setSearchOpen(false)
    setQuery('')
  }
  function openSearch() {
    setSearchOpen(true)
    setTimeout(() => searchRef.current?.focus(), 0)
  }
  useEffect(() => {
    const controller = new AbortController()
    setError(false); setCities([]); setLoading(false); setSearchOpen(false); setQuery('')
    if (!value.state) return () => controller.abort()
    if (cache.has(value.state)) { setCities(cache.get(value.state)); return () => controller.abort() }
    setLoading(true)
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${value.state}/municipios?orderBy=nome`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { if (!Array.isArray(data)) throw new Error(); if (!controller.signal.aborted) { cache.set(value.state, data); setCities(data) } })
      .catch(e => { if (e.name !== 'AbortError') setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [value.state, retry])
  return <div className="space-y-2"><p className="text-xs font-semibold text-gray-500 uppercase">{label} {required ? '*' : '(opcional)'}</p><div className="grid grid-cols-[90px_minmax(0,1fr)] gap-2">
    <select aria-label="Estado" required={required} className="input-field" value={value.state || ''} onChange={e => onChange({ state: e.target.value || null, city: '', municipality_code: null })}><option value="">UF</option>{STATES.map(uf => <option key={uf}>{uf}</option>)}</select>
    <div className="flex min-w-0 gap-2"><select aria-label="Cidade" required={required} className="input-field min-w-0 flex-1" disabled={!value.state || loading || error} value={value.municipality_code || ''} onChange={e => { const city = cities.find(c => String(c.id) === e.target.value); if (city) chooseCity(city) }}>
      <option value="">{loading ? 'Carregando...' : value.city && !value.municipality_code ? `${value.city} — confirme` : 'Selecione sua cidade'}</option>{cities.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
    </select><button type="button" aria-label="Pesquisar cidade" title="Pesquisar cidade" disabled={!value.state || loading || error} onClick={openSearch} className="shrink-0 w-11 h-11 rounded-xl border border-gray-200 text-primary-600 inline-flex items-center justify-center hover:bg-primary-50 disabled:opacity-40"><Search size={19}/></button></div>
  </div>{searchOpen && <div className="rounded-xl border border-primary-200 bg-white shadow-sm p-3"><div className="flex gap-2"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input ref={searchRef} type="search" aria-label="Digite o nome da cidade" placeholder="Digite o nome da cidade" className="input-field pl-9" value={query} onChange={event => setQuery(event.target.value)}/></div><button type="button" onClick={() => setSearchOpen(false)} aria-label="Fechar pesquisa de cidade" className="px-2 text-gray-500"><X size={19}/></button></div><div className="max-h-52 overflow-y-auto mt-2" role="listbox" aria-label="Cidades encontradas">{results.map(city => <button type="button" role="option" aria-selected={String(city.id) === String(value.municipality_code)} key={city.id} onClick={() => chooseCity(city)} className="block w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-primary-50">{city.nome}</button>)}{!results.length && <p className="p-3 text-sm text-gray-500">Nenhuma cidade encontrada neste estado.</p>}</div></div>}{description && <p className="text-xs text-gray-400">{description}</p>}{error && <div role="alert" className="text-xs text-red-600"><p>A lista do IBGE está indisponível. Seus dados anteriores serão preservados se você não alterar a localização.</p><button type="button" className="mt-1 underline font-semibold" onClick={() => setRetry(n => n + 1)}>Tentar novamente</button></div>}</div>
}
