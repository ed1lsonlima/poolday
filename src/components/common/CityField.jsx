import { useEffect, useState } from 'react'
export const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const cache = new Map()
export default function CityField({ value, onChange, required = false, label = 'Localização', description = 'Usada em relatórios regionais agregados. Não coletamos sua localização exata.' }) {
  const [cities, setCities] = useState([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError(false); setCities([]); setLoading(false)
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
    <select aria-label="Cidade" required={required} className="input-field min-w-0" disabled={!value.state || loading || error} value={value.municipality_code || ''} onChange={e => { const city = cities.find(c => String(c.id) === e.target.value); onChange({ state: value.state, city: city?.nome || '', municipality_code: city ? String(city.id) : null }) }}>
      <option value="">{loading ? 'Carregando...' : value.city && !value.municipality_code ? `${value.city} — confirme` : 'Selecione sua cidade'}</option>{cities.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
    </select>
  </div>{description && <p className="text-xs text-gray-400">{description}</p>}{error && <div role="alert" className="text-xs text-red-600"><p>A lista do IBGE está indisponível. Seus dados anteriores serão preservados se você não alterar a localização.</p><button type="button" className="mt-1 underline font-semibold" onClick={() => setRetry(n => n + 1)}>Tentar novamente</button></div>}</div>
}
