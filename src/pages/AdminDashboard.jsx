import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Bell, Download, MapPin, MessageCircle, RefreshCw, ShieldCheck, Users, Wallet, Waves } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { dayBR, downloadCSV, inPeriod, money, report, riskSignals } from '../lib/adminReports'
import AdminMFA from '../components/common/AdminMFA'
import BrazilMap from '../components/common/BrazilMap'

const TABS = [
  ['overview', 'Visão geral', Activity], ['finance', 'Financeiro', Wallet],
  ['users', 'Pessoas', Users], ['properties', 'Espaços', Waves],
  ['chats', 'Conversas', MessageCircle],
  ['regions', 'Regiões', MapPin], ['alerts', 'Alertas', Bell],
  ['audit', 'Auditoria', ShieldCheck],
]
const LABEL = {
  pending: 'Pendente', confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Concluída',
  approved: 'Aprovado', rejected: 'Recusado', refunded: 'Reembolsado', charged_back: 'Contestação',
  in_mediation: 'Em disputa', in_process: 'Em processamento',
  approve_property: 'Aprovar espaço', reject_property: 'Recusar espaço', pause_property: 'Pausar espaço',
  suspend_user: 'Suspender conta', restore_user: 'Restaurar conta', verify_user: 'Marcar verificado',
  unverify_user: 'Remover verificação', resolve_event: 'Concluir revisão',
}

async function adminRequest(body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sua sessão expirou. Entre novamente.')
  const response = await fetch('/api/admin', {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${session.access_token}`, ...(body && { 'Content-Type': 'application/json' }) },
    ...(body && { body: JSON.stringify(body) }),
  })
  const result = await response.json()
  if (!response.ok) { const error = new Error(result.error); error.code = result.code; throw error }
  return result
}

async function adminChatRequest(bookingId) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sua sessão expirou. Entre novamente.')
  const response = await fetch(`/api/admin?action=chat-detail&bookingId=${encodeURIComponent(bookingId)}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
  const result = await response.json()
  if (!response.ok) { const error = new Error(result.error); error.code = result.code; throw error }
  return result
}

function Badge({ children, warning }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${warning ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>{children}</span>
}
function Metric({ label, value, note, icon: Icon }) {
  return <article className="bg-white border border-gray-100 p-5 rounded-2xl"><div className="flex justify-between text-sm text-gray-500"><span>{label}</span><Icon size={18} className="text-primary-500"/></div><p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-3 break-words">{value}</p><p className="text-xs text-gray-400 mt-2">{note}</p></article>
}
function Table({ headers, children }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{headers.map(h => <th key={h} className="bg-gray-50 px-4 py-3 text-xs uppercase tracking-wide text-gray-500 whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{children}</tbody></table></div>
}
function Cell({ children }) { return <td className="px-4 py-4 align-top">{children}</td> }
function Empty({ children = 'Nenhum registro neste período.' }) { return <p className="text-center text-gray-400 text-sm py-12">{children}</p> }
function ExportButton({ rows, name }) {
  return <button disabled={!rows.length} onClick={() => downloadCSV(rows, name)} className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 disabled:opacity-40"><Download size={16}/>Exportar CSV</button>
}

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [mfa, setMfa] = useState(false)
  const [tab, setTab] = useState('overview')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [pendingAction, setPendingAction] = useState(null)
  const [reason, setReason] = useState('')
  const [acting, setActing] = useState(false)
  const [chatSearch, setChatSearch] = useState('')
  const [chatDetail, setChatDetail] = useState(null)
  const [chatBusy, setChatBusy] = useState(false)
  const dialog = useRef(null)

  const load = useCallback(async () => {
    setBusy(true); setError('')
    try { setData(await adminRequest()); setMfa(false) }
    catch (e) { if (e.code === 'MFA_REQUIRED') { setData(null); setMfa(true) } else setError(e.message || 'Não foi possível carregar o painel.') }
    finally { setBusy(false) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (pendingAction) dialog.current?.showModal() }, [pendingAction])

  const summary = useMemo(() => data ? report(data, from, to) : null, [data, from, to])
  const signals = useMemo(() => data ? riskSignals(data) : [], [data])
  const usersById = useMemo(() => new Map(data?.users.map(user => [user.id, user]) || []), [data])
  const propertiesById = useMemo(() => new Map(data?.properties.map(property => [property.id, property]) || []), [data])

  function startAction(action, id, name) { setReason(''); setPendingAction({ action, id, name }) }
  async function openChat(bookingId) {
    setChatBusy(true)
    try { setChatDetail(await adminChatRequest(bookingId)) }
    catch (e) { toast.error(e.message); if (e.code === 'MFA_REQUIRED') { setData(null); setMfa(true) } }
    finally { setChatBusy(false) }
  }
  async function submitAction(event) {
    event.preventDefault(); setActing(true)
    try {
      await adminRequest({ ...pendingAction, reason: reason.trim() })
      toast.success('Alteração concluída e registrada na auditoria.')
      dialog.current.close(); setPendingAction(null); await load()
    } catch (e) {
      toast.error(e.message)
      if (e.code === 'MFA_REQUIRED') { dialog.current.close(); setData(null); setMfa(true) }
    } finally { setActing(false) }
  }

  if (mfa) return <div className="min-h-[80vh] bg-gray-50 px-4 py-4"><AdminMFA onVerified={load}/></div>
  if (!data) return <div className="max-w-xl mx-auto text-center px-4 py-24"><ShieldCheck size={38} className="mx-auto text-primary-500 mb-4"/><h1 className="text-2xl font-bold">Administração PoolDay</h1><p role="status" className="text-gray-500 mt-4">{busy ? 'Verificando acesso seguro...' : error}</p>{!busy && <button className="btn-primary mt-5" onClick={load}>Tentar novamente</button>}</div>

  const people = data.users.filter(user => (!role || user.role === role) && `${user.name} ${user.email} ${user.city}`.toLowerCase().includes(search.toLowerCase()) && inPeriod(user, from, to))
  const properties = data.properties.filter(property => `${property.name} ${property.city}`.toLowerCase().includes(search.toLowerCase()))
  const events = data.events.filter(event => !event.resolved_at)
  const waiting = data.properties.filter(property => property.moderation_status === 'pending')
  const actionButton = (action, id, name) => <button onClick={() => startAction(action, id, name)} className="text-xs font-semibold text-primary-600 hover:underline py-1 mr-3">{LABEL[action]}</button>
  const cohortHosts = summary.users.filter(user => user.role === 'host')
  const cohortHostIds = new Set(cohortHosts.map(user => user.id))
  const withSpace = new Set(data.properties.filter(property => cohortHostIds.has(property.host_id)).map(property => property.host_id))
  const withPayment = new Set(data.payments.filter(payment => payment.status === 'approved' && withSpace.has(payment.host_id)).map(payment => payment.host_id))

  return <div className="min-h-screen bg-[#f6f9fc] pb-12"><div className="max-w-7xl mx-auto px-4 sm:px-6 py-7">
    <header className="flex flex-wrap items-start justify-between gap-4 mb-6"><div><p className="flex items-center gap-2 text-primary-600 text-xs font-bold tracking-widest uppercase"><ShieldCheck size={15}/>Acesso exclusivo e protegido</p><h1 className="font-bold text-3xl text-gray-900 mt-2">Central PoolDay<span className="text-primary-500">.</span></h1><p className="text-sm text-gray-500 mt-2">Seu negócio, anfitriões e comunidade em um só lugar.</p></div><button onClick={load} disabled={busy} className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold"><RefreshCw size={16} className={busy ? 'animate-spin' : ''}/>{busy ? 'Atualizando...' : 'Atualizar'}</button></header>
    {error && <p role="alert" className="bg-red-50 text-red-700 p-4 rounded-xl mb-5">{error} Os dados abaixo são da última atualização concluída.</p>}
    <nav aria-label="Seções administrativas" className="flex gap-1 p-1.5 bg-white border border-gray-100 rounded-2xl overflow-x-auto mb-6">{TABS.map(([id, label, Icon]) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); setSearch('') }} className={`flex items-center gap-2 whitespace-nowrap px-4 py-3 rounded-xl font-semibold text-sm ${tab === id ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}><Icon size={16}/>{label}{id === 'alerts' && events.length > 0 && <span className="bg-amber-100 text-amber-800 rounded-full px-1.5 text-xs">{events.length}</span>}</button>)}</nav>
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6"><div className="flex flex-wrap items-end gap-3"><label className="text-xs text-gray-500">De<input aria-label="Início do período" type="date" className="input-field mt-1 !w-auto" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)}/></label><label className="text-xs text-gray-500">Até<input aria-label="Fim do período" type="date" className="input-field mt-1 !w-auto" value={to} min={from || undefined} onChange={e => setTo(e.target.value)}/></label><button onClick={() => { setFrom(''); setTo('') }} className="text-xs font-semibold text-primary-600 py-3">Todo o período</button></div><p className="text-xs text-gray-400">Atualizado às {new Date(data.generatedAt).toLocaleTimeString('pt-BR')} · horário de Brasília</p></div>
    <p className="text-xs text-gray-400 mb-5">O período usa a data de criação de cada cadastro, reserva ou pagamento. Moderação e alertas sempre mostram todas as pendências.</p>

    {tab === 'overview' && <div className="space-y-6">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4"><Metric label="Volume pago líquido" value={money(summary.gross)} note="Aprovados, descontando reembolsos" icon={Wallet}/><Metric label="Comissão PoolDay registrada" value={money(summary.fees)} note="Não representa saldo bancário" icon={Activity}/><Metric label="Cadastros no período" value={summary.users.length} note={`${cohortHosts.length} anfitriões`} icon={Users}/><Metric label="Reservas iniciadas" value={summary.bookings.length} note={`${summary.expired.length} expiradas sem pagamento`} icon={Waves}/></div>
      <div className="grid lg:grid-cols-2 gap-6"><section className="bg-white border border-gray-100 rounded-3xl p-6"><h2 className="font-bold text-lg">Conversão dos cadastros</h2><p className="text-xs text-gray-400 mt-1 mb-5">Contas criadas no período e evolução acumulada até hoje.</p>{[['Cadastros', summary.users.length], ['Anfitriões', cohortHosts.length], ['Anfitriões com espaço', withSpace.size], ['Com pagamento aprovado', withPayment.size]].map(([label, value]) => <div key={label} className="mb-4"><div className="flex justify-between text-sm mb-1"><span>{label}</span><b>{value}</b></div><div className="h-2 bg-gray-100 rounded-full"><div className="h-2 bg-primary-400 rounded-full" style={{ width: `${summary.users.length ? value / summary.users.length * 100 : 0}%` }}/></div></div>)}</section>
      <section className="bg-white border border-gray-100 rounded-3xl p-6"><h2 className="font-bold text-lg">Precisam de você</h2><div className="space-y-3 mt-5">{[[`${waiting.length} espaços aguardando aprovação`, 'properties'], [`${events.length} notificações abertas`, 'alerts'], [`${signals.length} sinais para revisão`, 'alerts'], [`${summary.needsReconciliation} pagamentos a conciliar`, 'finance']].map(([label, target]) => <button key={label} onClick={() => setTab(target)} className="w-full flex justify-between p-4 bg-gray-50 hover:bg-primary-50 rounded-xl text-sm text-left">{label}<span>→</span></button>)}</div><p className="text-xs text-gray-400 mt-4">Sinais pedem revisão humana; não comprovam irregularidade.</p></section></div>
      <BrazilMap users={data.users} bookings={summary.bookings} payments={summary.payments} from={from} to={to}/>
    </div>}

    {tab === 'finance' && <div className="space-y-6">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4"><Metric label="Volume líquido" value={money(summary.gross)} note="Aprovado menos reembolsado" icon={Wallet}/><Metric label="Comissão registrada" value={money(summary.fees)} note="Exclui operações em conciliação" icon={Activity}/><Metric label="Reembolsado" value={money(summary.refunds)} note="Informado pelo Mercado Pago" icon={Wallet}/><Metric label="Contestações" value={money(summary.chargebacks)} note="Sob disputa ou estorno" icon={ShieldCheck}/></div>
      <p className="bg-sky-50 border border-sky-100 text-sky-900 text-sm p-4 rounded-2xl">Os totais vêm de pagamentos verificados. A PoolDay cobra 0% nas três primeiras reservas promocionais do anfitrião e 15% depois. Tarifas do Mercado Pago aparecem separadas. Os números não representam saldo bancário nem lucro após despesas.</p>
      <section className="bg-white border border-gray-100 rounded-3xl overflow-hidden"><div className="p-5 flex flex-wrap justify-between gap-3"><div><h2 className="font-bold text-lg">Resultado por anfitrião</h2><p className="text-xs text-gray-400">“A conciliar” significa que o provedor ainda não informou todos os valores.</p></div><ExportButton name="anfitrioes" rows={summary.hosts.map(host => ({ nome: host.name, email: host.email, volume_pago: host.gross, comissao_poolday: host.fees, liquido_informado: host.net, pagamentos: host.paid, a_conciliar: host.needsReconciliation, promocionais_usadas: host.promo }))}/></div><Table headers={['Anfitrião', 'Volume', 'PoolDay', 'Líquido informado', 'Promoção']}>
        {summary.hosts.map(host => <tr key={host.id}><Cell><b>{host.name}</b><p className="text-xs text-gray-400">{host.email}</p></Cell><Cell>{money(host.gross)}</Cell><Cell>{money(host.fees)}</Cell><Cell>{money(host.net)}{host.needsReconciliation > 0 && <p className="text-xs text-amber-600">{host.needsReconciliation} a conciliar</p>}</Cell><Cell><Badge>{host.promo} / 3 usadas</Badge></Cell></tr>)}
      </Table>{!summary.hosts.length && <Empty/>}</section>
      <section className="bg-white border border-gray-100 rounded-3xl overflow-hidden"><div className="p-5 flex flex-wrap justify-between gap-3"><h2 className="font-bold text-lg">Livro de pagamentos</h2><ExportButton name="pagamentos" rows={summary.payments.map(payment => ({ pagamento: payment.payment_id, reserva: payment.booking_id, anfitriao: usersById.get(payment.host_id)?.name, status: payment.status, bruto: payment.amount, reembolsado: payment.refunded_amount, comissao: payment.platform_fee, tarifa_provedor: payment.provider_fee, liquido: payment.host_net, criado: payment.payment_created_at || payment.created_at, atualizado: payment.provider_updated_at }))}/></div><Table headers={['Pagamento / reserva', 'Anfitrião', 'Situação', 'Valor', 'Reembolso', 'Atualizado']}>
        {summary.payments.map(payment => <tr key={payment.payment_id}><Cell><b>{payment.payment_id}</b><p className="text-xs text-gray-400 break-all">{payment.booking_id}</p></Cell><Cell>{usersById.get(payment.host_id)?.name || '—'}</Cell><Cell><Badge warning={payment.status !== 'approved' || Number(payment.refunded_amount) > 0}>{LABEL[payment.status] || payment.status}{Number(payment.refunded_amount) > 0 ? ' · parcial/total' : ''}</Badge></Cell><Cell>{money(payment.amount)}</Cell><Cell>{money(payment.refunded_amount)}</Cell><Cell>{dayBR(payment.provider_updated_at)}</Cell></tr>)}
      </Table>{!summary.payments.length && <Empty>O histórico financeiro começa com as novas notificações do Mercado Pago.</Empty>}</section>
      <section className="bg-white border border-gray-100 rounded-3xl overflow-hidden"><div className="p-5 flex flex-wrap justify-between gap-3"><h2 className="font-bold text-lg">Reservas</h2><ExportButton name="reservas" rows={summary.bookings.map(booking => ({ reserva: booking.id, espaco: propertiesById.get(booking.property_id)?.name, cliente: usersById.get(booking.client_id)?.name, anfitriao: usersById.get(booking.host_id)?.name, diaria: booking.date, status: booking.status, total: booking.total_amount, promocao: booking.promotion_applied }))}/></div><Table headers={['Espaço', 'Cliente', 'Diária', 'Situação', 'Total']}>
        {summary.bookings.map(booking => <tr key={booking.id}><Cell>{propertiesById.get(booking.property_id)?.name || '—'}<p className="text-xs text-gray-400">{booking.id.slice(0, 8)}</p></Cell><Cell>{usersById.get(booking.client_id)?.name || '—'}</Cell><Cell>{dayBR(booking.date)}</Cell><Cell><Badge warning={booking.status !== 'confirmed'}>{booking.status === 'pending' && booking.hold_expires_at && new Date(booking.hold_expires_at) < new Date() ? 'Expirada sem pagamento' : LABEL[booking.status]}</Badge></Cell><Cell>{money(booking.total_amount)}</Cell></tr>)}
      </Table>{!summary.bookings.length && <Empty/>}</section>
    </div>}

    {tab === 'users' && <section className="bg-white border border-gray-100 rounded-3xl overflow-hidden"><div className="p-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-lg">Pessoas da comunidade</h2><p className="text-xs text-gray-400">Suspender bloqueia novas reservas e publicações; não apaga dados.</p></div><ExportButton name="cadastros" rows={people.map(user => ({ nome: user.name, email: user.email, tipo: user.role, cidade: user.city, uf: user.state, cadastro: user.created_at, suspenso: user.suspended, verificado: user.verified }))}/><div className="flex flex-wrap gap-2 w-full"><input aria-label="Buscar pessoas" className="input-field flex-1" placeholder="Nome, email ou cidade" value={search} onChange={e => setSearch(e.target.value)}/><select aria-label="Tipo de conta" className="input-field !w-auto" value={role} onChange={e => setRole(e.target.value)}><option value="">Todos</option><option value="host">Anfitriões</option><option value="client">Clientes</option></select></div></div><Table headers={['Pessoa', 'Região', 'Cadastro', 'Conta', 'Ações']}>
      {people.map(user => <tr key={user.id}><Cell><b>{user.name}</b><p className="text-xs text-gray-500 break-all">{user.email}</p></Cell><Cell>{user.city || 'Não informada'}{user.state ? ` / ${user.state}` : ''}</Cell><Cell>{dayBR(user.created_at)}</Cell><Cell><Badge warning={user.suspended}>{user.suspended ? 'Suspensa' : user.role === 'host' ? 'Anfitrião' : 'Cliente'}</Badge>{user.verified && <p className="text-xs text-green-600 mt-1">Verificado</p>}</Cell><Cell>{user.id === data.ownerId ? <span className="text-xs text-gray-400">Conta proprietária</span> : <>{actionButton(user.suspended ? 'restore_user' : 'suspend_user', user.id, user.name)}{actionButton(user.verified ? 'unverify_user' : 'verify_user', user.id, user.name)}</>}</Cell></tr>)}
    </Table>{!people.length && <Empty/>}</section>}

    {tab === 'properties' && <section className="bg-white border border-gray-100 rounded-3xl p-5"><div className="flex justify-between items-center gap-3 flex-wrap mb-5"><div><h2 className="font-bold text-lg">Moderação de espaços</h2><p className="text-xs text-gray-400">Novos anúncios e edições só aparecem após aprovação.</p></div><Badge warning>{waiting.length} para analisar</Badge></div><input aria-label="Buscar espaços" className="input-field mb-5" placeholder="Buscar espaço ou cidade" value={search} onChange={e => setSearch(e.target.value)}/><div className="space-y-4">
      {properties.map(property => <article key={property.id} className="border border-gray-100 rounded-2xl p-4 flex flex-col sm:flex-row gap-4">{property.images?.[0] && <img src={property.images[0]} alt={property.name} className="w-full sm:w-32 h-32 object-cover rounded-xl"/>}<div className="flex-1 min-w-0"><div className="flex gap-2 items-center flex-wrap"><h3 className="font-bold">{property.name}</h3><Badge warning={property.moderation_status !== 'approved'}>{property.moderation_status === 'pending' ? 'Em análise' : property.moderation_status === 'rejected' ? 'Recusado' : property.is_active ? 'Publicado' : 'Pausado'}</Badge></div><p className="text-sm text-gray-500 mt-1">{property.city} / {property.state} · {money(property.price_per_day)} por diária · {usersById.get(property.host_id)?.name}</p><p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap break-words">{property.description}</p>{property.moderation_note && <p className="text-xs text-amber-700 mt-2">Última análise: {property.moderation_note}</p>}<details className="mt-3"><summary className="text-xs text-primary-600 cursor-pointer">Ver fotos ({property.images?.length || 0})</summary><div className="flex gap-2 overflow-x-auto mt-2">{property.images?.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Foto ${index + 1}`} className="h-28 max-w-40 object-cover rounded-lg" loading="lazy"/></a>)}</div></details><div className="flex flex-wrap mt-3">{actionButton('approve_property', property.id, property.name)}{actionButton('reject_property', property.id, property.name)}{property.is_active && actionButton('pause_property', property.id, property.name)}</div></div></article>)}
    </div>{!properties.length && <Empty>Nenhum espaço cadastrado.</Empty>}</section>}

    {tab === 'regions' && <BrazilMap users={data.users} bookings={data.bookings} payments={data.payments} from={from} to={to}/>} 
    {tab === 'chats' && <section className="bg-white border border-gray-100 rounded-3xl p-5"><h2 className="font-bold text-lg">Conversas das reservas</h2><p className="text-xs text-gray-500 mt-1 mb-4">Acesso exclusivo da sua conta, com verificação adicional e registro de cada consulta. Revise denúncias e tentativas bloqueadas antes de tomar qualquer medida.</p><input aria-label="Buscar conversa" className="input-field mb-4" placeholder="Busque por nome, espaço ou número da reserva" value={chatSearch} onChange={event => setChatSearch(event.target.value)}/><div className="space-y-2 max-h-[32rem] overflow-y-auto">{data.bookings.filter(booking => Number(booking.paid_amount) > 0 && `${booking.id} ${usersById.get(booking.client_id)?.name || ''} ${usersById.get(booking.host_id)?.name || ''} ${propertiesById.get(booking.property_id)?.name || ''}`.toLowerCase().includes(chatSearch.toLowerCase())).map(booking => <button key={booking.id} disabled={chatBusy} onClick={() => openChat(booking.id)} className="w-full text-left border border-gray-100 rounded-xl p-3 hover:bg-primary-50 disabled:opacity-50"><p className="font-semibold text-sm">{propertiesById.get(booking.property_id)?.name || 'Espaço'} · {dayBR(booking.date)}</p><p className="text-xs text-gray-500">{usersById.get(booking.client_id)?.name || 'Cliente'} ↔ {usersById.get(booking.host_id)?.name || 'Anfitrião'} · {booking.id.slice(0,8)}</p></button>)}{!data.bookings.some(booking => Number(booking.paid_amount) > 0) && <Empty>Nenhuma reserva paga com chat disponível.</Empty>}</div></section>}
    {tab === 'alerts' && <div className="space-y-6"><p className="bg-amber-50 border border-amber-100 text-amber-900 rounded-2xl p-4 text-sm">Sinais de atenção não são acusações. Confira o contexto e registre o motivo antes de agir. Reembolsos devem ser realizados e conferidos no Mercado Pago.</p><section className="bg-white border border-gray-100 rounded-3xl p-5"><h2 className="font-bold text-lg mb-4">Notificações e revisões</h2><div className="divide-y divide-gray-100">{events.map(event => <div key={event.id} className="py-4 flex flex-wrap justify-between gap-3"><div><Badge warning={event.severity !== 'info'}>{event.severity === 'urgent' ? 'Prioridade alta' : event.severity === 'review' ? 'Revisar' : 'Informação'}</Badge><h3 className="font-semibold text-sm mt-2">{event.title}</h3>{event.detail && <p className="text-sm text-gray-500 mt-1">{event.detail}</p>}<p className="text-xs text-gray-400 mt-1">{dayBR(event.created_at)} · registro {event.entity_id?.slice(0, 8) || '—'}</p></div>{actionButton('resolve_event', event.id, event.title)}</div>)}</div>{!events.length && <Empty>Tudo em dia. Sem notificações abertas.</Empty>}</section><section className="bg-white border border-gray-100 rounded-3xl p-5"><h2 className="font-bold text-lg">Padrões para observar</h2>{signals.map(signal => <div key={signal.id} className="py-4 border-b border-gray-100"><h3 className="text-sm font-semibold">{signal.title}</h3><p className="text-sm text-gray-500 mt-1">{signal.detail}</p></div>)}{!signals.length && <Empty>Nenhum padrão atingiu os critérios de atenção.</Empty>}<p className="text-xs text-gray-400 mt-4">Critérios: telefone compartilhado, três ou mais cancelamentos, alteração de preço acima de 50%, possível contato externo e eventos de pagamento. Não usamos rastreamento oculto nem decisões automáticas de culpa.</p></section></div>}

    {tab === 'audit' && <section className="bg-white border border-gray-100 rounded-3xl overflow-hidden"><div className="p-5 flex justify-between flex-wrap gap-3"><h2 className="font-bold text-lg">Histórico de ações administrativas</h2><ExportButton name="auditoria" rows={data.audit.filter(item => inPeriod(item, from, to))}/></div><Table headers={['Quando', 'Ação', 'Registro', 'Motivo']}>
      {data.audit.filter(item => inPeriod(item, from, to)).map(item => <tr key={item.id}><Cell>{new Date(item.created_at).toLocaleString('pt-BR')}</Cell><Cell>{LABEL[item.action] || item.action}</Cell><Cell><span className="text-xs break-all">{item.entity_id}</span></Cell><Cell>{item.reason}</Cell></tr>)}
    </Table>{!data.audit.length && <Empty>Nenhuma ação administrativa registrada.</Empty>}</section>}

    {chatDetail && <div className="fixed inset-0 z-[70] bg-black/50 p-3 sm:p-6 flex items-center justify-center" onClick={() => setChatDetail(null)}><div role="dialog" aria-modal="true" aria-label="Histórico da conversa" className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6" onClick={event => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">Conversa da reserva</h2><p className="text-xs text-gray-500 break-all">{chatDetail.booking.id}</p></div><button onClick={() => setChatDetail(null)} className="text-sm font-semibold text-primary-600">Fechar</button></div><div className="grid sm:grid-cols-3 gap-2 my-4 text-xs">{chatDetail.acceptances.map(item => <p key={item.user_id} className="bg-blue-50 rounded-lg p-2">{item.role === 'host' ? 'Anfitrião' : 'Cliente'} aceitou em {new Date(item.accepted_at).toLocaleString('pt-BR')}</p>)}</div><h3 className="font-bold text-sm mb-2">Mensagens</h3><div className="space-y-2 max-h-72 overflow-y-auto bg-slate-50 rounded-xl p-3">{chatDetail.messages.map(message => <p key={message.id} className="bg-white rounded-lg p-2 text-sm break-words"><b>{usersById.get(message.sender_id)?.name || 'Participante'}:</b> {message.content}<span className="block text-[10px] text-gray-400 mt-1">{new Date(message.created_at).toLocaleString('pt-BR')}</span></p>)}{!chatDetail.messages.length && <p className="text-sm text-gray-500">Nenhuma mensagem enviada.</p>}</div>{chatDetail.hasMore && <p className="text-xs text-amber-700 mt-2">Exibindo as 500 mensagens mais recentes.</p>}<h3 className="font-bold text-sm mt-5 mb-2">Denúncias ({chatDetail.reports.length})</h3>{chatDetail.reports.map(item => <p key={item.id} className="text-sm bg-amber-50 rounded-lg p-2 mb-1 break-words">{item.reason} · {usersById.get(item.reporter_id)?.name || 'Participante'}</p>)}<h3 className="font-bold text-sm mt-5 mb-2">Tentativas bloqueadas ({chatDetail.moderation.length})</h3>{chatDetail.moderation.map(item => <p key={item.id} className="text-sm bg-red-50 rounded-lg p-2 mb-1 break-words"><b>{item.kind}:</b> {item.content}</p>)}</div></div>}
    <dialog ref={dialog} onCancel={() => { if (!acting) setPendingAction(null) }} onClose={() => setPendingAction(null)} className="date-dialog"><form onSubmit={submitAction} className="p-6"><h2 className="font-bold text-xl">{LABEL[pendingAction?.action]}</h2><p className="text-gray-500 text-sm mt-2 break-words">{pendingAction?.name}</p><label className="text-sm font-semibold block mt-5" htmlFor="admin-reason">Motivo da ação</label><textarea id="admin-reason" className="input-field mt-2" rows={3} minLength={5} maxLength={1000} required value={reason} onChange={e => setReason(e.target.value)} placeholder="Descreva o que foi verificado..."/><p className="text-xs text-gray-400 mt-2">A ação e o motivo ficarão registrados na auditoria.</p><div className="flex gap-3 mt-5"><button type="button" disabled={acting} className="btn-secondary flex-1" onClick={() => dialog.current.close()}>Cancelar</button><button disabled={acting || reason.trim().length < 5} className="btn-primary flex-1">{acting ? 'Salvando...' : 'Confirmar'}</button></div></form></dialog>
  </div></div>
}

