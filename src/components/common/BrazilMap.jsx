import { useEffect, useMemo, useState } from 'react'
import { inPeriod, money, paymentDate } from '../../lib/adminReports'

const geoCache = new Map()
const project = ([lon, lat]) => [(lon + 75) * 12, (7 - lat) * 12]
const ringsOf = geometry => geometry.type === 'MultiPolygon' ? geometry.coordinates.flat() : geometry.coordinates
const pathsOf = geometry => ringsOf(geometry).map(ring => ring.map((point, i) => `${i ? 'L' : 'M'}${project(point).map(n => n.toFixed(1)).join(',')}`).join(' ') + 'Z').join(' ')
async function geo(path) {
  if (geoCache.has(path)) return geoCache.get(path)
  const response = await fetch(`https://servicodados.ibge.gov.br/api/v3/malhas/${path}?formato=application/vnd.geo+json&qualidade=minima`, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error('IBGE indisponível')
  const data = await response.json(); geoCache.set(path, data); return data
}
function center(data) {
  const points = data.features.flatMap(f => ringsOf(f.geometry).flat())
  return project([points.reduce((s,p) => s+p[0],0)/points.length, points.reduce((s,p) => s+p[1],0)/points.length])
}

export default function BrazilMap({ users, bookings, payments, from = '', to = '' }) {
  const [mode, setMode] = useState('clients')
  const [country, setCountry] = useState(null)
  const [points, setPoints] = useState([])
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const groups = useMemo(() => {
    const groups = new Map()
    const add = (user, value) => {
      if (!user?.state || !value) return
      const key = user.municipality_code || user.state
      const group = groups.get(key) || { key, state: user.state, code: user.municipality_code, name: user.municipality_code ? `${user.city} / ${user.state}` : `${user.state} (região aproximada)`, value: 0 }
      group.value += value; groups.set(key, group)
    }
    const byId = new Map(users.map(u => [u.id,u]))
    if (mode === 'clients' || mode === 'hosts') users.filter(u => inPeriod(u, from, to) && u.role === (mode === 'clients' ? 'client' : 'host')).forEach(u => add(u,1))
    if (mode === 'bookings') bookings.filter(b => inPeriod(b, from, to)).forEach(b => add(byId.get(b.client_id),1))
    if (mode === 'revenue') payments.filter(p => p.status === 'approved' && inPeriod(p, from, to, paymentDate)).forEach(p => add(byId.get(p.host_id), Math.max(0, Number(p.amount)-Number(p.refunded_amount))))
    return [...groups.values()].sort((a,b) => b.value-a.value)
  }, [users,bookings,payments,mode,from,to])
  useEffect(() => { geo('paises/BR').then(setCountry).catch(() => setError(true)) }, [])
  useEffect(() => {
    let alive = true; setLoading(true); setPoints([]); setSelected(null)
    // Bound requests. The complete city ranking remains available below the map.
    Promise.all(groups.slice(0,50).map(async group => {
      try { const data = await geo(group.code ? `municipios/${group.code}` : `estados/${group.state}`); return { ...group, point: center(data) } } catch { return null }
    })).then(rows => { if (alive) { setPoints(rows.filter(Boolean)); setLoading(false) } })
    return () => { alive = false }
  }, [groups])
  const format = value => mode === 'revenue' ? money(value) : value.toLocaleString('pt-BR')
  return <section className="bg-white rounded-3xl border border-gray-100 p-5 sm:p-6">
    <div className="flex flex-wrap justify-between items-center gap-3"><div><h2 className="font-bold text-lg">PoolDay pelo Brasil</h2><p className="text-sm text-gray-500">Distribuição por cidade declarada no cadastro</p></div><select aria-label="Informação do mapa" className="input-field !w-auto" value={mode} onChange={e => setMode(e.target.value)}><option value="clients">Clientes</option><option value="hosts">Anfitriões</option><option value="bookings">Reservas</option><option value="revenue">Volume pago por anfitrião</option></select></div>
    <div className="grid md:grid-cols-[1.5fr_1fr] gap-6 mt-5"><div className="rounded-2xl bg-sky-50/70 border border-sky-100 p-3 relative">
      {country ? <svg viewBox="0 0 520 510" className="w-full max-h-[440px]" role="img" aria-label="Mapa do Brasil com pontos agregados por cidade">{country.features.map((feature,i) => <path key={i} d={pathsOf(feature.geometry)} fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="1.2"/>)}{points.map(group => <g key={group.key} role="button" tabIndex={0} aria-label={`${group.name}: ${format(group.value)}`} onClick={() => setSelected(group)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(group) } }} className="cursor-pointer"><circle cx={group.point[0]} cy={group.point[1]} r={Math.min(22,6+Math.sqrt(group.value/(mode==='revenue'?100:1))*2)} fill="#0284c7" fillOpacity=".28"/><circle cx={group.point[0]} cy={group.point[1]} r="4" fill="#0284c7" stroke="white" strokeWidth="1.5"/><title>{group.name}: {format(group.value)}</title></g>)}</svg> : <div className="h-72 flex items-center justify-center text-sm text-gray-500">{error ? 'Mapa indisponível. Os dados continuam na lista.' : 'Carregando mapa do Brasil...'}</div>}
      {selected && <div className="absolute bottom-3 left-3 right-3 bg-white/95 rounded-xl p-3 text-sm shadow"><b>{selected.name}</b><span className="float-right text-primary-600 font-bold">{format(selected.value)}</span></div>}
    </div><div><p className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-3">Principais cidades / regiões</p><div className="max-h-80 overflow-y-auto space-y-3">{groups.map((group,i) => <div key={group.key} className="flex items-center justify-between gap-3 text-sm border-b border-gray-50 pb-3"><span><span className="text-gray-400 mr-2">{i+1}.</span>{group.name}</span><b>{format(group.value)}</b></div>)}{!groups.length && <p className="text-gray-500 text-sm">Ainda não há localização cadastrada para este filtro.</p>}</div><p className="text-xs text-gray-400 mt-4">{loading ? 'Posicionando regiões...' : `${points.length} regiões posicionadas.`} {users.filter(u => !u.state).length} cadastros sem UF. Pontos representam regiões, não endereços. Até 50 regiões no mapa; lista completa ao lado.</p></div></div>
    <p className="text-xs text-gray-400 mt-4">Base cartográfica: IBGE. Origem dos cadastros, não tráfego de visitantes nem rastreamento em tempo real.</p>
  </section>
}
