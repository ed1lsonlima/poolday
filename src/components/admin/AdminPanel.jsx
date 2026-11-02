import { useMemo, useRef, useState, useEffect } from 'react'
import { Activity, Bell, CircleAlert, Gift, Home, MessageCircle, RefreshCw, ShieldCheck, Users, Wallet, Waves } from 'lucide-react'
import { dayBR, hostCancellations, inPeriod, isUnpaidHoldExpired, money, report, riskSignals } from '../../lib/adminReports'
import { adminHome, referralTotals, splitEvents } from '../../lib/adminInbox'
import { REFERRAL_STATUS } from '../../lib/referral'
import BrazilMap from '../common/BrazilMap'
import { Badge, Cell, Chips, Collapsible, CopyButton, Empty, ExportButton, Metric, SummaryLine, Table } from './AdminUI'

export const TABS = [
  ['overview', 'Início', Home], ['properties', 'Espaços', Waves], ['users', 'Pessoas', Users],
  ['bookings', 'Reservas e pagamentos', Wallet], ['referrals', 'Indicações', Gift], ['records', 'Registros', ShieldCheck],
]
export const LABEL = {
  pending: 'Pendente', confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Concluída',
  approved: 'Aprovado', rejected: 'Recusado', refunded: 'Reembolsado', charged_back: 'Contestação',
  in_mediation: 'Em disputa', in_process: 'Em processamento',
  approve_property: 'Aprovar espaço', reject_property: 'Recusar espaço', pause_property: 'Pausar espaço',
  suspend_user: 'Suspender conta', restore_user: 'Restaurar conta', verify_user: 'Marcar verificado',
  unverify_user: 'Remover verificação', resolve_event: 'Arquivar aviso (não aprova espaço)',
  view_booking_chat: 'Consulta de conversa', view_property: 'Revisão de anúncio',
  marcar_indicacao_paga: 'Marcar indicação como paga', recusar_indicacao: 'Recusar indicação',
  desativar_indicador: 'Desativar link do indicador', reativar_indicador: 'Reativar link do indicador',
}
const NOTICE_REASON = 'Aviso informativo lido no sino.'
const cents = value => money(Number(value || 0) / 100)
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

function Section({ title, note, children, actions }) {
  return <section className="bg-white border border-gray-100 rounded-3xl overflow-hidden"><div className="p-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-lg">{title}</h2>{note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}</div>{actions}</div>{children}</section>
}

function PendingItem({ icon: Icon, tone = 'primary', title, detail, children }) {
  return <li className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
    <div className="flex items-start gap-3 flex-1 min-w-0"><span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone === 'orange' ? 'bg-orange-50 text-orange-600' : tone === 'red' ? 'bg-red-50 text-red-600' : 'bg-primary-50 text-primary-600'}`}><Icon size={18}/></span><div className="min-w-0"><p className="font-semibold text-sm text-gray-900 break-words">{title}</p>{detail && <p className="text-xs text-gray-500 mt-0.5 break-words">{detail}</p>}</div></div>
    <div className="flex flex-wrap gap-2 sm:justify-end">{children}</div>
  </li>
}
const primaryBtn = 'inline-flex items-center justify-center rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50'
const ghostBtn = 'inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold px-4 py-2.5 disabled:opacity-50'
const linkBtn = 'text-xs font-semibold text-primary-600 hover:underline py-1.5 disabled:opacity-50'

// Painel de administração. Só apresenta e organiza: todo acesso a dados passa pelas funções recebidas,
// que chamam /api/admin (com MFA, auditoria e registro de cada consulta às conversas).
export default function AdminPanel({ data, tab, onTab, busy, error, onReload, onAction, onApprove, onOpenProperty, onOpenChat, acting }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [propertyFilter, setPropertyFilter] = useState('pending')
  const [referralFilter, setReferralFilter] = useState('a_pagar')
  const [chatSearch, setChatSearch] = useState('')
  const [pending, setPending] = useState(null)
  const [reason, setReason] = useState('')
  const [paidOn, setPaidOn] = useState(today)
  const [bellOpen, setBellOpen] = useState(false)
  const [propertyDetail, setPropertyDetail] = useState(null)
  const [chatDetail, setChatDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const dialog = useRef(null)

  useEffect(() => { if (pending) dialog.current?.showModal() }, [pending])

  const summary = useMemo(() => report(data, from, to), [data, from, to])
  const signals = useMemo(() => riskSignals(data), [data])
  const home = useMemo(() => adminHome(data), [data])
  const { alerts, notices } = useMemo(() => splitEvents(data.events), [data])
  const usersById = useMemo(() => new Map(data.users.map(user => [user.id, user])), [data])
  const propertiesById = useMemo(() => new Map(data.properties.map(property => [property.id, property])), [data])
  const bookingsById = useMemo(() => new Map(data.bookings.map(booking => [booking.id, booking])), [data])
  const referrersById = useMemo(() => new Map((data.referrers || []).map(item => [item.user_id, item])), [data])
  const totals = referralTotals(data.referrals)

  function ask(action, id, name, extra = {}) { setReason(''); setPaidOn(today()); setPending({ action, id, name, ...extra }) }
  async function submit(event) {
    event.preventDefault()
    const ok = await onAction({ action: pending.action, id: pending.id, reason: reason.trim(), ...(pending.action === 'marcar_indicacao_paga' && { paidOn }) })
    if (ok) { dialog.current?.close(); setPending(null) }
  }
  async function archiveNotices(list) {
    for (const notice of list) if (!(await onAction({ action: 'resolve_event', id: notice.id, reason: NOTICE_REASON }, { quiet: true, skipReload: true }))) break
    await onReload()
  }
  async function showProperty(id) { setLoadingDetail(true); const detail = await onOpenProperty(id); setLoadingDetail(false); if (detail) setPropertyDetail(detail) }
  async function showChat(id) { setLoadingDetail(true); const detail = await onOpenChat(id); setLoadingDetail(false); if (detail) setChatDetail(detail) }
  const actionButton = (action, id, name) => <button type="button" onClick={() => ask(action, id, name)} className={`${linkBtn} mr-3`}>{LABEL[action]}</button>
  const bookingLabel = id => { const booking = bookingsById.get(id); return booking ? `${propertiesById.get(booking.property_id)?.name || 'Espaço'} · ${dayBR(booking.date)}` : `Reserva ${String(id).slice(0, 8)}` }
  const showPeriod = ['overview', 'users', 'bookings', 'records'].includes(tab)
  const periodBar = <div className="space-y-2"><div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-2 sm:gap-3"><label className="text-xs text-gray-500 min-w-0">De<input aria-label="Início do período" type="date" className="input-field mt-1 sm:!w-auto" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)}/></label><label className="text-xs text-gray-500 min-w-0">Até<input aria-label="Fim do período" type="date" className="input-field mt-1 sm:!w-auto" value={to} min={from || undefined} onChange={e => setTo(e.target.value)}/></label>{(from || to) && <button type="button" onClick={() => { setFrom(''); setTo('') }} className="text-xs font-semibold text-primary-600 py-2 col-span-2 text-left">Todo o período</button>}</div><p className="text-xs text-gray-400">Atualizado às {new Date(data.generatedAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Brasília). O período usa a data de criação; pendências sempre aparecem todas.</p></div>

  const people = data.users.filter(user => (!role || user.role === role) && `${user.name} ${user.email} ${user.city}`.toLowerCase().includes(search.toLowerCase()) && inPeriod(user, from, to))
  const propertyGroups = {
    pending: data.properties.filter(p => p.moderation_status === 'pending'),
    active: data.properties.filter(p => p.moderation_status === 'approved' && p.is_active),
    paused: data.properties.filter(p => p.moderation_status === 'approved' && !p.is_active),
    rejected: data.properties.filter(p => p.moderation_status === 'rejected'),
  }
  const properties = propertyGroups[propertyFilter].filter(p => `${p.name} ${p.city}`.toLowerCase().includes(search.toLowerCase()))
  const cohortHosts = summary.users.filter(user => user.role === 'host')
  const cohortHostIds = new Set(cohortHosts.map(user => user.id))
  const withSpace = new Set(data.properties.filter(p => cohortHostIds.has(p.host_id)).map(p => p.host_id))
  const withPayment = new Set(data.payments.filter(p => p.status === 'approved' && withSpace.has(p.host_id)).map(p => p.host_id))
  const chatBookings = data.bookings.filter(b => Number(b.paid_amount) > 0 && `${b.id} ${usersById.get(b.client_id)?.name || ''} ${usersById.get(b.host_id)?.name || ''} ${propertiesById.get(b.property_id)?.name || ''}`.toLowerCase().includes(chatSearch.toLowerCase()))
  const referrals = (data.referrals || []).filter(item => referralFilter === 'all' || item.status === referralFilter)
  const verificationByHost = new Map((data.verifications || []).map(item => [item.host_id, item.due_at]))
  const hostCancelCount = id => hostCancellations(data.bookings.filter(b => b.host_id === id))

  return <div className="min-h-screen bg-[#f6f9fc] pb-16"><div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7">
    <header className="flex items-start justify-between gap-3 mb-5">
      <div className="min-w-0"><p className="flex items-center gap-2 text-primary-600 text-xs font-bold tracking-widest uppercase"><ShieldCheck size={15}/>Acesso protegido</p><h1 className="font-bold text-2xl sm:text-3xl text-gray-900 mt-1">Central PoolDay<span className="text-primary-500">.</span></h1></div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <button type="button" onClick={() => setBellOpen(open => !open)} aria-expanded={bellOpen} aria-label={`Avisos informativos: ${notices.length}`} className="relative w-11 h-11 inline-flex items-center justify-center bg-white border border-gray-200 rounded-xl"><Bell size={18}/>{notices.length > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-gray-700 text-white text-[11px] font-bold flex items-center justify-center">{notices.length > 99 ? '99+' : notices.length}</span>}</button>
          {bellOpen && <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white border border-gray-100 shadow-xl rounded-2xl z-40 overflow-hidden">
            <div className="p-4 border-b border-gray-100"><p className="font-bold text-sm">Avisos informativos</p><p className="text-xs text-gray-400">Não exigem ação e não contam como pendência.</p></div>
            <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">{notices.slice(0, 50).map(notice => <li key={notice.id} className="px-4 py-3 flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium break-words">{notice.title}</p><p className="text-xs text-gray-400">{dayBR(notice.created_at)}</p></div><button type="button" disabled={acting} onClick={() => archiveNotices([notice])} className={linkBtn}>Arquivar</button></li>)}</ul>
            {!notices.length ? <p className="text-sm text-gray-400 p-4">Nenhum aviso novo.</p> : <div className="p-3 border-t border-gray-100 flex justify-between items-center"><span className="text-xs text-gray-400">{notices.length > 50 ? `Mostrando 50 de ${notices.length}` : ''}</span><button type="button" disabled={acting} onClick={() => archiveNotices(notices)} className="text-sm font-semibold text-primary-600 disabled:opacity-50">{acting ? 'Arquivando...' : 'Arquivar todos'}</button></div>}
          </div>}
        </div>
        <button type="button" onClick={onReload} disabled={busy} aria-label="Atualizar dados" className="h-11 inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 sm:px-4 text-sm font-semibold"><RefreshCw size={16} className={busy ? 'animate-spin' : ''}/><span className="hidden sm:inline">{busy ? 'Atualizando...' : 'Atualizar'}</span></button>
      </div>
    </header>
    {error && <p role="alert" className="bg-red-50 text-red-700 p-4 rounded-xl mb-5 text-sm">{error} Os dados abaixo são da última atualização concluída.</p>}

    <nav aria-label="Seções administrativas" className="grid grid-cols-3 lg:grid-cols-6 gap-1 p-1.5 bg-white border border-gray-100 rounded-2xl mb-5">{TABS.map(([id, label, Icon]) => {
      const count = id === 'overview' ? home.pendingCount : id === 'properties' ? home.waiting.length : id === 'referrals' ? totals.toPayCount : id === 'records' ? alerts.length : 0
      return <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => { onTab(id); setSearch('') }} className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-2.5 rounded-xl font-semibold text-xs sm:text-sm leading-tight text-center ${tab === id ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}><Icon size={17}/><span>{label}</span>{count > 0 && <span className={`absolute top-1 right-1 sm:static min-w-5 h-5 px-1 rounded-full text-[11px] flex items-center justify-center ${tab === id ? 'bg-white text-primary-600' : 'bg-orange-500 text-white'}`}>{count}</span>}</button>
    })}</nav>

    {showPeriod && tab !== 'overview' && <div className="mb-5">{periodBar}</div>}

    {tab === 'overview' && <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3"><Metric label="Anfitriões novos na semana" value={home.newHostsWeek} note="Últimos 7 dias" icon={Users}/><Metric label="Espaços para aprovar" value={home.waiting.length} icon={Waves}/><Metric label="Reservas com problema" value={home.problemBookings} note="Pagamento ou conversa sinalizada" icon={CircleAlert}/><Metric label="Indicações a pagar" value={cents(home.referralsToPay)} note={data.referrals === null ? 'Programa ainda não ativado' : `${totals.toPayCount} por Pix`} icon={Gift} accent/></div>
      <Section title="Precisa de você agora" note={home.pendingCount ? `${home.pendingCount} ${home.pendingCount === 1 ? 'item' : 'itens'}. Avisos informativos ficam no sino.` : undefined}>
        {home.pendingCount ? <ul className="divide-y divide-gray-100 border-t border-gray-100">
          {home.waiting.map(property => <PendingItem key={`p${property.id}`} icon={Waves} title={`Aprovar espaço: ${property.name}`} detail={`${property.city} / ${property.state} · ${money(property.price_per_day)} por diária · ${usersById.get(property.host_id)?.name || 'Anfitrião'}`}><button type="button" disabled={loadingDetail} onClick={() => showProperty(property.id)} className={ghostBtn}>Ver anúncio</button><button type="button" disabled={acting} onClick={() => onApprove(property)} className={primaryBtn}>Aprovar</button></PendingItem>)}
          {home.chats.map(flag => <PendingItem key={`c${flag.bookingId}`} icon={MessageCircle} tone="red" title={`Revisar conversa: ${bookingLabel(flag.bookingId)}`} detail={[flag.blocked && `${flag.blocked} tentativa(s) de contato externo bloqueada(s)`, flag.reports && `${flag.reports} denúncia(s)`].filter(Boolean).join(' · ')}><button type="button" disabled={loadingDetail} onClick={() => showChat(flag.bookingId)} className={primaryBtn}>Revisar conversa</button></PendingItem>)}
          {home.toPay.map(item => { const referrer = referrersById.get(item.indicador_id); return <PendingItem key={`r${item.id}`} icon={Gift} tone="orange" title={`Pagar indicação: ${cents(item.valor_centavos)} para ${referrer?.nome || 'indicador'}`} detail={`Anfitrião: ${usersById.get(item.anfitriao_id)?.name || '—'} · espaço aprovado em ${dayBR(item.aprovada_em)}`}><button type="button" onClick={() => ask('marcar_indicacao_paga', item.id, `${cents(item.valor_centavos)} para ${referrer?.nome || 'indicador'}`, { pix: referrer?.chave_pix })} className={primaryBtn}>Pagar</button></PendingItem> })}
          {home.overdue.map(item => <PendingItem key={`v${item.host_id}`} icon={ShieldCheck} tone="orange" title={`Verificação vencida: ${item.user.name}`} detail={`Prazo terminou em ${dayBR(item.due_at)}. O espaço não recebe novas reservas. Confira os documentos no WhatsApp.`}>{item.user.id !== data.ownerId && actionButton('verify_user', item.user.id, item.user.name)}</PendingItem>)}
          {[...home.paymentAlerts, ...home.otherAlerts].map(event => <PendingItem key={`e${event.id}`} icon={CircleAlert} tone={event.severity === 'urgent' ? 'red' : 'orange'} title={event.title} detail={[event.detail, dayBR(event.created_at)].filter(Boolean).join(' · ')}>{bookingsById.has(event.entity_id) && <button type="button" disabled={loadingDetail} onClick={() => showChat(event.entity_id)} className={ghostBtn}>Ver conversa</button>}{propertiesById.has(event.entity_id) && <button type="button" disabled={loadingDetail} onClick={() => showProperty(event.entity_id)} className={ghostBtn}>Ver anúncio</button>}<button type="button" onClick={() => ask('resolve_event', event.id, event.title)} className={ghostBtn}>Resolvido</button></PendingItem>)}
        </ul> : <Empty>Tudo em dia. Nada exige sua ação agora.</Empty>}
      </Section>
      <Section title="Resumo do período" note="Pagamentos verificados. Não representa saldo bancário.">
        <div className="px-5 pb-4">{periodBar}</div>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-5 pb-5"><SummaryLine label="Volume pago líquido" value={money(summary.gross)}/><SummaryLine label="Comissão PoolDay registrada" value={money(summary.fees)}/><SummaryLine label="Reservas iniciadas" value={`${summary.bookings.length} (${summary.expired.length} expiradas sem pagamento)`}/></dl>
      </Section>
    </div>}

    {tab === 'properties' && <div className="space-y-4">
      <Chips label="Filtrar espaços" value={propertyFilter} onChange={setPropertyFilter} options={[['pending', 'Para aprovar', propertyGroups.pending.length], ['active', 'Ativos', propertyGroups.active.length], ['paused', 'Pausados', propertyGroups.paused.length], ['rejected', 'Recusados', propertyGroups.rejected.length]]}/>
      <input aria-label="Buscar espaços" className="input-field" placeholder="Buscar espaço ou cidade" value={search} onChange={e => setSearch(e.target.value)}/>
      <p className="text-xs text-gray-400">Novos anúncios e edições só aparecem para clientes após aprovação.</p>
      {properties.map(property => propertyFilter === 'pending'
        ? <article key={property.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col sm:flex-row gap-4">{property.images?.[0] && <img src={property.images[0]} alt={property.name} className="w-full sm:w-36 h-40 sm:h-32 object-cover rounded-xl"/>}<div className="flex-1 min-w-0"><div className="flex gap-2 items-center flex-wrap"><h3 className="font-bold">{property.name}</h3><Badge warning>Em análise</Badge></div><p className="text-sm text-gray-500 mt-1">{property.city} / {property.state} · {money(property.price_per_day)} por diária · {usersById.get(property.host_id)?.name}</p><p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap break-words line-clamp-4">{property.description || 'Sem descrição adicional.'}</p>{property.moderation_note && <p className="text-xs text-amber-700 mt-2">Última análise: {property.moderation_note}</p>}<div className="flex flex-wrap gap-2 mt-3"><button type="button" disabled={loadingDetail} onClick={() => showProperty(property.id)} className={ghostBtn}>Ver anúncio completo</button><button type="button" disabled={acting} onClick={() => onApprove(property)} className={primaryBtn}>Aprovar e publicar</button><button type="button" onClick={() => ask('reject_property', property.id, property.name)} className={ghostBtn}>Recusar</button></div></div></article>
        : <details key={property.id} className="group bg-white border border-gray-100 rounded-2xl"><summary className="flex items-center gap-3 p-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">{property.images?.[0] && <img src={property.images[0]} alt="" className="w-12 h-12 object-cover rounded-lg shrink-0"/>}<span className="min-w-0 flex-1"><span className="block font-semibold text-sm truncate">{property.name}</span><span className="block text-xs text-gray-500 truncate">{property.city} / {property.state} · {money(property.price_per_day)} · {usersById.get(property.host_id)?.name}</span></span><Badge tone={propertyFilter === 'active' ? 'success' : 'muted'}>{propertyFilter === 'active' ? 'Publicado' : propertyFilter === 'paused' ? 'Pausado' : 'Recusado'}</Badge></summary>
          <div className="px-4 pb-4 flex flex-wrap gap-2">{property.moderation_note && <p className="text-xs text-amber-700 basis-full">Última análise: {property.moderation_note}</p>}<button type="button" disabled={loadingDetail} onClick={() => showProperty(property.id)} className={ghostBtn}>Ver anúncio</button>{property.moderation_status === 'rejected' && <button type="button" disabled={acting} onClick={() => onApprove(property)} className={primaryBtn}>Aprovar e publicar</button>}{property.is_active && <button type="button" onClick={() => ask('pause_property', property.id, property.name)} className={ghostBtn}>Pausar</button>}{property.moderation_status !== 'rejected' && <button type="button" onClick={() => ask('reject_property', property.id, property.name)} className={ghostBtn}>Recusar</button>}</div></details>)}
      {!properties.length && <Empty>{propertyFilter === 'pending' ? 'Nenhum espaço aguardando aprovação.' : 'Nenhum espaço neste filtro.'}</Empty>}
    </div>}

    {tab === 'users' && <div className="space-y-4">
      <Section title="Pessoas da comunidade" note="Suspender bloqueia novas reservas e publicações; não apaga dados." actions={<ExportButton name="cadastros" rows={people.map(user => ({ nome: user.name, email: user.email, tipo: user.role, cidade: user.city, uf: user.state, cadastro: user.created_at, suspenso: user.suspended, verificado: user.verified }))}/>}>
        <div className="flex flex-wrap gap-2 px-5 pb-4"><input aria-label="Buscar pessoas" className="input-field flex-1 min-w-[12rem]" placeholder="Nome, e-mail ou cidade" value={search} onChange={e => setSearch(e.target.value)}/><select aria-label="Tipo de conta" className="input-field !w-auto" value={role} onChange={e => setRole(e.target.value)}><option value="">Todos</option><option value="host">Anfitriões</option><option value="client">Clientes</option></select></div>
        <ul className="divide-y divide-gray-100 border-t border-gray-100">{people.map(user => <li key={user.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"><div className="flex-1 min-w-0"><p className="font-semibold text-sm">{user.name} {user.verified && <span className="text-xs text-green-600 font-medium">· Verificado</span>}{!user.verified && verificationByHost.has(user.id) && <span className={`text-xs font-medium ${Date.parse(verificationByHost.get(user.id)) <= Date.now() ? 'text-red-600' : 'text-amber-700'}`}> · Verificar até {dayBR(verificationByHost.get(user.id))}</span>}{hostCancelCount(user.id) > 0 && <span className="text-xs text-red-600 font-medium"> · {hostCancelCount(user.id)} cancelamento(s) de reserva paga</span>}</p><p className="text-xs text-gray-500 break-all">{user.email}</p><p className="text-xs text-gray-400">{user.city || 'Cidade não informada'}{user.state ? ` / ${user.state}` : ''} · desde {dayBR(user.created_at)}</p></div><Badge warning={user.suspended}>{user.suspended ? 'Suspensa' : user.role === 'host' ? 'Anfitrião' : 'Cliente'}</Badge><div className="shrink-0">{user.id === data.ownerId ? <span className="text-xs text-gray-400">Conta proprietária</span> : <>{actionButton(user.suspended ? 'restore_user' : 'suspend_user', user.id, user.name)}{actionButton(user.verified ? 'unverify_user' : 'verify_user', user.id, user.name)}</>}</div></li>)}</ul>
        {!people.length && <Empty/>}
      </Section>
      <Collapsible title="Conversão dos cadastros" note="Contas criadas no período e evolução acumulada até hoje."><div className="px-5 pb-5">{[['Cadastros', summary.users.length], ['Anfitriões', cohortHosts.length], ['Anfitriões com espaço', withSpace.size], ['Com pagamento aprovado', withPayment.size]].map(([label, value]) => <div key={label} className="mb-4"><div className="flex justify-between text-sm mb-1"><span>{label}</span><b>{value}</b></div><div className="h-2 bg-gray-100 rounded-full"><div className="h-2 bg-primary-400 rounded-full" style={{ width: `${summary.users.length ? value / summary.users.length * 100 : 0}%` }}/></div></div>)}</div></Collapsible>
      <Collapsible title="Mapa de regiões" note="Cadastros, reservas e pagamentos por estado."><div className="px-2 sm:px-5 pb-5"><BrazilMap users={data.users} bookings={data.bookings} payments={data.payments} from={from} to={to}/></div></Collapsible>
    </div>}

    {tab === 'bookings' && <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3"><Metric label="Volume líquido" value={money(summary.gross)} note="Aprovado menos reembolsado" icon={Wallet}/><Metric label="Comissão registrada" value={money(summary.fees)} note="Exclui operações em conciliação" icon={Activity}/><Metric label="Reembolsado" value={money(summary.refunds)} note="Informado pelo Mercado Pago" icon={Wallet}/><Metric label="Contestações" value={money(summary.chargebacks)} note="Sob disputa ou estorno" icon={ShieldCheck}/></div>
      <p className="bg-sky-50 border border-sky-100 text-sky-900 text-sm p-4 rounded-2xl">Os totais vêm de pagamentos verificados. Nas três primeiras reservas, a taxa do anfitrião é 0% e o cliente paga R$ 50 de serviço PoolDay; depois, a taxa do anfitrião é 15% da diária anunciada. Tarifas do Mercado Pago aparecem separadas. Os números não representam saldo bancário nem lucro após despesas.</p>
      <Collapsible title="Resultado por anfitrião" note="“A conciliar” significa que o provedor ainda não informou todos os valores." actions={<ExportButton name="anfitrioes" rows={summary.hosts.map(host => ({ nome: host.name, email: host.email, volume_pago: host.gross, comissao_poolday: host.fees, liquido_informado: host.net, pagamentos: host.paid, a_conciliar: host.needsReconciliation, promocionais_usadas: host.promo, cancelamentos_reserva_paga: host.hostCancellations }))}/>}><Table headers={['Anfitrião', 'Volume', 'PoolDay', 'Líquido informado', 'Promoção', 'Cancelou reserva paga']}>
        {summary.hosts.map(host => <tr key={host.id}><Cell><b>{host.name}</b><p className="text-xs text-gray-400">{host.email}</p></Cell><Cell>{money(host.gross)}</Cell><Cell>{money(host.fees)}</Cell><Cell>{money(host.net)}{host.needsReconciliation > 0 && <p className="text-xs text-amber-600">{host.needsReconciliation} a conciliar</p>}</Cell><Cell><Badge>{host.promo} / 3 usadas</Badge></Cell><Cell>{host.hostCancellations}</Cell></tr>)}
      </Table>{!summary.hosts.length && <Empty/>}</Collapsible>
      <Collapsible title="Livro de pagamentos" badge={summary.needsReconciliation > 0 && <Badge warning>{summary.needsReconciliation} a conciliar</Badge>} actions={<ExportButton name="pagamentos" rows={summary.payments.map(payment => ({ pagamento: payment.payment_id, reserva: payment.booking_id, anfitriao: usersById.get(payment.host_id)?.name, status: payment.status, bruto: payment.amount, reembolsado: payment.refunded_amount, comissao: payment.platform_fee, tarifa_provedor: payment.provider_fee, liquido: payment.host_net, criado: payment.payment_created_at || payment.created_at, atualizado: payment.provider_updated_at }))}/>}><Table headers={['Pagamento / reserva', 'Anfitrião', 'Situação', 'Valor', 'Reembolso', 'Atualizado']}>
        {summary.payments.map(payment => <tr key={payment.payment_id}><Cell><b>{payment.payment_id}</b><p className="text-xs text-gray-400 break-all">{payment.booking_id}</p></Cell><Cell>{usersById.get(payment.host_id)?.name || '—'}</Cell><Cell><Badge warning={payment.status !== 'approved' || Number(payment.refunded_amount) > 0}>{LABEL[payment.status] || payment.status}{Number(payment.refunded_amount) > 0 ? ' · parcial/total' : ''}</Badge></Cell><Cell>{money(payment.amount)}</Cell><Cell>{money(payment.refunded_amount)}</Cell><Cell>{dayBR(payment.provider_updated_at)}</Cell></tr>)}
      </Table>{!summary.payments.length && <Empty>O histórico financeiro começa com as novas notificações do Mercado Pago.</Empty>}</Collapsible>
      <Collapsible title="Reservas" note={`${summary.bookings.length} no período`} actions={<ExportButton name="reservas" rows={summary.bookings.map(booking => ({ reserva: booking.id, espaco: propertiesById.get(booking.property_id)?.name, cliente: usersById.get(booking.client_id)?.name, anfitriao: usersById.get(booking.host_id)?.name, diaria: booking.date, status: booking.status, total: booking.total_amount, promocao: booking.promotion_applied }))}/>}><Table headers={['Espaço', 'Cliente', 'Diária', 'Situação', 'Total']}>
        {summary.bookings.map(booking => <tr key={booking.id}><Cell>{propertiesById.get(booking.property_id)?.name || '—'}<p className="text-xs text-gray-400">{booking.id.slice(0, 8)}</p></Cell><Cell>{usersById.get(booking.client_id)?.name || '—'}</Cell><Cell>{dayBR(booking.date)}</Cell><Cell><Badge warning={booking.status !== 'confirmed'}>{isUnpaidHoldExpired(booking) ? 'Expirada sem pagamento' : LABEL[booking.status]}</Badge></Cell><Cell>{money(booking.total_amount)}</Cell></tr>)}
      </Table>{!summary.bookings.length && <Empty/>}</Collapsible>
      <Collapsible title="Conversas das reservas" badge={home.chats.length > 0 && <Badge warning>{home.chats.length} sinalizada(s)</Badge>} note="Acesso exclusivo, com verificação adicional e registro de cada consulta.">
        <div className="px-5 pb-5"><p className="text-xs text-gray-500 mb-3">Revise denúncias e tentativas bloqueadas antes de tomar qualquer medida. Abrir uma conversa fica registrado na auditoria.</p><input aria-label="Buscar conversa" className="input-field mb-3" placeholder="Nome, espaço ou número da reserva" value={chatSearch} onChange={event => setChatSearch(event.target.value)}/><div className="space-y-2 max-h-[32rem] overflow-y-auto">{chatBookings.map(booking => { const flag = home.chats.find(item => item.bookingId === booking.id); return <button key={booking.id} type="button" disabled={loadingDetail} onClick={() => showChat(booking.id)} className="w-full text-left border border-gray-100 rounded-xl p-3 hover:bg-primary-50 disabled:opacity-50"><p className="font-semibold text-sm flex items-center gap-2 flex-wrap">{propertiesById.get(booking.property_id)?.name || 'Espaço'} · {dayBR(booking.date)}{flag && <Badge warning>Sinalizada</Badge>}</p><p className="text-xs text-gray-500">{usersById.get(booking.client_id)?.name || 'Cliente'} ↔ {usersById.get(booking.host_id)?.name || 'Anfitrião'} · {booking.id.slice(0, 8)}</p></button> })}{!chatBookings.length && <Empty>Nenhuma reserva paga com chat disponível.</Empty>}</div></div>
      </Collapsible>
    </div>}

    {tab === 'referrals' && (data.referrals === null
      ? <p className="bg-amber-50 border border-amber-100 text-amber-900 text-sm p-4 rounded-2xl">O programa de indicações ainda não está ativo: falta aplicar a migração do banco. Nada é registrado até lá.</p>
      : <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3"><Metric label="A pagar" value={cents(totals.toPay)} note={`${totals.toPayCount} indicação(ões)`} icon={Gift} accent/><Metric label="Pago" value={cents(totals.paid)} note="Total já pago por Pix" icon={Wallet}/><Metric label="Indicadores ativos" value={(data.referrers || []).filter(item => item.ativo).length} note={`${(data.referrers || []).length} cadastrados`} icon={Users}/></div>
        <p className="text-xs text-gray-500">R$ 20 por anfitrião novo, devidos quando você aprova o primeiro espaço dele. Pagamento manual por Pix. Limite de 10 pagas por indicador por mês; autoindicação é bloqueada no cadastro.</p>
        <Chips label="Filtrar indicações" value={referralFilter} onChange={setReferralFilter} options={[['a_pagar', 'A pagar', totals.toPayCount], ['aguardando_aprovacao', 'Em análise'], ['cadastrou', 'Cadastrou'], ['paga', 'Pagas'], ['recusada', 'Recusadas'], ['all', 'Todas']]}/>
        <div className="flex justify-end"><ExportButton name="indicacoes" rows={referrals.map(item => ({ indicacao: item.id, indicador: referrersById.get(item.indicador_id)?.nome, whatsapp_indicador: referrersById.get(item.indicador_id)?.whatsapp, anfitriao: usersById.get(item.anfitriao_id)?.name, espaco: propertiesById.get(item.property_id)?.name, status: REFERRAL_STATUS[item.status], valor: Number(item.valor_centavos) / 100, cadastro: item.created_at, aprovada: item.aprovada_em, paga: item.paga_em, observacao: item.pagamento_observacao || item.recusa_motivo }))}/></div>
        <ul className="space-y-3">{referrals.map(item => { const referrer = referrersById.get(item.indicador_id); const host = usersById.get(item.anfitriao_id); const property = propertiesById.get(item.property_id); return <li key={item.id} className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-gray-400">Indicador</p><p className="font-semibold">{referrer?.nome || '—'}{referrer && !referrer.ativo && <span className="text-xs text-red-600 font-medium"> · link desativado</span>}</p></div><div className="text-right shrink-0"><Badge tone={item.status === 'paga' ? 'success' : item.status === 'recusada' ? 'muted' : undefined} warning={item.status === 'a_pagar'}>{REFERRAL_STATUS[item.status]}</Badge><p className="font-bold mt-1">{cents(item.valor_centavos)}</p></div></div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-sm">
            <div><dt className="text-xs text-gray-500">WhatsApp</dt><dd className="font-medium flex items-center gap-2 flex-wrap">{referrer?.whatsapp ? <a className="text-primary-600 hover:underline" href={`https://wa.me/55${referrer.whatsapp.replace(/^55(?=\d{10,11}$)/, '')}`} target="_blank" rel="noopener noreferrer">{referrer.whatsapp}</a> : '—'}</dd></div>
            <div><dt className="text-xs text-gray-500">Chave Pix</dt><dd className="font-medium flex items-center gap-2 flex-wrap break-all">{referrer?.chave_pix || '—'}<CopyButton value={referrer?.chave_pix} label="Copiar Pix"/></dd></div>
            <div><dt className="text-xs text-gray-500">Anfitrião indicado</dt><dd className="font-medium break-words">{host?.name || '—'}<span className="block text-xs text-gray-400 break-all">{host?.email}</span></dd></div>
            <div><dt className="text-xs text-gray-500">Espaço</dt><dd className="font-medium">{property ? <button type="button" disabled={loadingDetail} onClick={() => showProperty(property.id)} className="text-primary-600 hover:underline text-left">{property.name}</button> : 'Ainda não enviado'}</dd></div>
          </dl>
          <p className="text-xs text-gray-400 mt-3">Cadastro {dayBR(item.created_at)}{item.aprovada_em ? ` · aprovado ${dayBR(item.aprovada_em)}` : ''}{item.paga_em ? ` · pago ${dayBR(item.paga_em)}` : ''}</p>
          {(item.pagamento_observacao || item.recusa_motivo) && <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 mt-2 break-words">{item.pagamento_observacao || item.recusa_motivo}</p>}
          {!['paga', 'recusada'].includes(item.status) && <div className="flex flex-wrap gap-2 mt-3">{item.status === 'a_pagar' && <button type="button" onClick={() => ask('marcar_indicacao_paga', item.id, `${cents(item.valor_centavos)} para ${referrer?.nome || 'indicador'}`, { pix: referrer?.chave_pix })} className={primaryBtn}>Marcar como pago</button>}<button type="button" onClick={() => ask('recusar_indicacao', item.id, `Indicação de ${host?.name || 'anfitrião'}`)} className={ghostBtn}>Recusar</button></div>}
        </li> })}</ul>
        {!referrals.length && <Empty>Nenhuma indicação neste filtro.</Empty>}
        <Collapsible title="Indicadores" note="Quem tem link. Desative o link de quem fizer envio em massa.">
          <ul className="divide-y divide-gray-100 border-t border-gray-100">{(data.referrers || []).map(item => { const mine = (data.referrals || []).filter(ref => ref.indicador_id === item.user_id); return <li key={item.user_id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2"><div className="flex-1 min-w-0"><p className="font-semibold text-sm">{item.nome || usersById.get(item.user_id)?.name || '—'} <span className="text-xs text-gray-400 font-normal">/i/{item.codigo}</span></p><p className="text-xs text-gray-500">{mine.length} indicação(ões) · {mine.filter(ref => ref.status === 'paga').length} paga(s){!item.ativo && item.desativado_motivo ? ` · desativado: ${item.desativado_motivo}` : ''}</p></div><Badge tone={item.ativo ? 'success' : 'muted'}>{item.ativo ? 'Link ativo' : 'Link desativado'}</Badge>{actionButton(item.ativo ? 'desativar_indicador' : 'reativar_indicador', item.user_id, item.nome || 'Indicador')}</li> })}</ul>
          {!(data.referrers || []).length && <Empty>Ninguém gerou link ainda.</Empty>}
        </Collapsible>
      </div>)}

    {tab === 'records' && <div className="space-y-4">
      <p className="bg-amber-50 border border-amber-100 text-amber-900 rounded-2xl p-4 text-sm">Sinais de atenção não são acusações. Confira o contexto e registre o motivo antes de agir. Reembolsos devem ser realizados e conferidos no Mercado Pago.</p>
      <Section title="Alertas que exigem atenção" note="Avisos apenas informativos ficam no sino.">
        <ul className="divide-y divide-gray-100 border-t border-gray-100">{alerts.map(event => <li key={event.id} className="p-4 flex flex-wrap justify-between gap-3"><div className="min-w-0"><Badge warning>{event.severity === 'urgent' ? 'Prioridade alta' : 'Revisar'}</Badge><h3 className="font-semibold text-sm mt-2 break-words">{event.title}</h3>{event.detail && <p className="text-sm text-gray-500 mt-1 break-words">{event.detail}</p>}<p className="text-xs text-gray-400 mt-1">{dayBR(event.created_at)} · registro {event.entity_id?.slice(0, 8) || '—'}</p></div>{actionButton('resolve_event', event.id, event.title)}</li>)}</ul>
        {!alerts.length && <Empty>Tudo em dia. Sem alertas abertos.</Empty>}
      </Section>
      <Collapsible title="Padrões para observar" badge={signals.length > 0 && <Badge>{signals.length}</Badge>} note="Critérios: telefone compartilhado, três ou mais cancelamentos, alteração de preço acima de 50%, possível contato externo e eventos de pagamento. Sem rastreamento oculto nem decisões automáticas.">
        <div className="px-5 pb-4">{signals.map(signal => <div key={signal.id} className="py-3 border-b border-gray-100"><h3 className="text-sm font-semibold">{signal.title}</h3><p className="text-sm text-gray-500 mt-1">{signal.detail}</p></div>)}{!signals.length && <Empty>Nenhum padrão atingiu os critérios de atenção.</Empty>}</div>
      </Collapsible>
      <Collapsible title="Auditoria" note="Histórico de ações administrativas e consultas registradas." defaultOpen actions={<ExportButton name="auditoria" rows={data.audit.filter(item => inPeriod(item, from, to))}/>}><Table headers={['Quando', 'Ação', 'Registro', 'Motivo']}>
        {data.audit.filter(item => inPeriod(item, from, to)).map(item => <tr key={item.id}><Cell><span className="whitespace-nowrap">{new Date(item.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span></Cell><Cell>{LABEL[item.action] || item.action}</Cell><Cell><span className="text-xs break-all">{item.entity_id}</span></Cell><Cell>{item.reason}</Cell></tr>)}
      </Table>{!data.audit.length && <Empty>Nenhuma ação administrativa registrada.</Empty>}</Collapsible>
    </div>}

    {propertyDetail && <div className="fixed inset-0 z-[70] bg-black/50 p-3 sm:p-6 flex items-center justify-center" onClick={() => setPropertyDetail(null)}><div role="dialog" aria-modal="true" aria-label="Anúncio completo para revisão" className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6" onClick={event => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-primary-600">Revisão do espaço</p><h2 className="text-xl font-extrabold mt-1">{propertyDetail.name}</h2><p className="text-xs text-gray-500 mt-1">{usersById.get(propertyDetail.host_id)?.name || 'Anfitrião'} · {propertyDetail.moderation_status === 'pending' ? 'Em análise' : propertyDetail.moderation_status === 'approved' ? 'Aprovado' : 'Recusado'}</p></div><button type="button" onClick={() => setPropertyDetail(null)} className="text-sm font-semibold text-primary-600">Voltar</button></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">{(propertyDetail.images || []).map((url, index) => <a href={url} key={url} target="_blank" rel="noreferrer"><img src={url} alt={`Foto ${index + 1}`} className="w-full aspect-square object-cover rounded-xl"/></a>)}</div><dl className="grid sm:grid-cols-2 gap-3 text-sm mt-5 rounded-xl bg-gray-50 p-4"><SummaryLine label="Tipo" value={propertyDetail.type === 'pool' ? 'Piscina' : 'Chácara'}/><SummaryLine label="Cidade e estado" value={`${propertyDetail.city} / ${propertyDetail.state}`}/><SummaryLine label="Bairro" value={propertyDetail.neighborhood || 'Não informado'}/><SummaryLine label="Valor da diária" value={money(propertyDetail.price_per_day)}/><SummaryLine label="Capacidade estimada" value={`${propertyDetail.max_capacity} pessoas`}/><SummaryLine label="Horário" value={`${propertyDetail.hora_inicio}h às ${propertyDetail.hora_fim}h`}/><SummaryLine label="Dias disponíveis" value={(propertyDetail.available_days || []).map(day => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][day]).join(', ') || 'Nenhum'}/><SummaryLine label="Comodidades" value={(propertyDetail.amenities || []).join(', ') || 'Nenhuma'}/></dl><div className="space-y-3 text-sm mt-5"><div><b>Descrição</b><p className="whitespace-pre-wrap break-words text-gray-600">{propertyDetail.description || 'Não informada'}</p></div><div><b>Regras</b><p className="whitespace-pre-wrap break-words text-gray-600">{propertyDetail.rules || 'Não informadas'}</p></div><div className="rounded-xl border border-amber-100 bg-amber-50 p-3"><b>Endereço privado · não aparece na busca</b><p className="break-words">{propertyDetail.address || 'Não informado'}{propertyDetail.cep ? ` · CEP ${propertyDetail.cep}` : ''}</p>{propertyDetail.landmark && <p>Ponto de referência: {propertyDetail.landmark}</p>}{propertyDetail.checkin_instructions && <p>Instruções: {propertyDetail.checkin_instructions}</p>}{propertyDetail.map_url && <a href={propertyDetail.map_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">Abrir mapa informado</a>}</div></div>
      {propertyDetail.moderation_status !== 'approved' && <div className="flex flex-col sm:flex-row gap-2 mt-5"><button type="button" disabled={acting} onClick={async () => { if (await onApprove(propertyDetail)) setPropertyDetail(null) }} className={`${primaryBtn} flex-1`}>Aprovar e publicar</button>{propertyDetail.moderation_status !== 'rejected' && <button type="button" onClick={() => { ask('reject_property', propertyDetail.id, propertyDetail.name); setPropertyDetail(null) }} className={`${ghostBtn} flex-1`}>Recusar</button>}</div>}
      <button type="button" onClick={() => setPropertyDetail(null)} className="btn-secondary mt-3 w-full">Voltar à lista</button></div></div>}
    {chatDetail && <div className="fixed inset-0 z-[70] bg-black/50 p-3 sm:p-6 flex items-center justify-center" onClick={() => setChatDetail(null)}><div role="dialog" aria-modal="true" aria-label="Histórico da conversa" className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6" onClick={event => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">Conversa da reserva</h2><p className="text-xs text-gray-500 break-all">{chatDetail.booking.id}</p><p className="text-xs text-gray-400 mt-1">Esta consulta foi registrada na auditoria.</p></div><button type="button" onClick={() => setChatDetail(null)} className="text-sm font-semibold text-primary-600">Fechar</button></div><div className="grid sm:grid-cols-3 gap-2 my-4 text-xs">{chatDetail.acceptances.map(item => <p key={item.user_id} className="bg-blue-50 rounded-lg p-2">{item.role === 'host' ? 'Anfitrião' : 'Cliente'} aceitou em {new Date(item.accepted_at).toLocaleString('pt-BR')}</p>)}</div><h3 className="font-bold text-sm mb-2">Mensagens</h3><div className="space-y-2 max-h-72 overflow-y-auto bg-slate-50 rounded-xl p-3">{chatDetail.messages.map(message => <p key={message.id} className="bg-white rounded-lg p-2 text-sm break-words"><b>{usersById.get(message.sender_id)?.name || 'Participante'}:</b> {message.content}<span className="block text-[10px] text-gray-400 mt-1">{new Date(message.created_at).toLocaleString('pt-BR')}</span></p>)}{!chatDetail.messages.length && <p className="text-sm text-gray-500">Nenhuma mensagem enviada.</p>}</div>{chatDetail.hasMore && <p className="text-xs text-amber-700 mt-2">Exibindo as 500 mensagens mais recentes.</p>}<h3 className="font-bold text-sm mt-5 mb-2">Denúncias ({chatDetail.reports.length})</h3>{chatDetail.reports.map(item => <p key={item.id} className="text-sm bg-amber-50 rounded-lg p-2 mb-1 break-words">{item.reason} · {usersById.get(item.reporter_id)?.name || 'Participante'}</p>)}<h3 className="font-bold text-sm mt-5 mb-2">Tentativas bloqueadas ({chatDetail.moderation.length})</h3>{chatDetail.moderation.map(item => <p key={item.id} className="text-sm bg-red-50 rounded-lg p-2 mb-1 break-words"><b>{item.kind}:</b> {item.content}</p>)}</div></div>}

    <dialog ref={dialog} onCancel={() => { if (!acting) setPending(null) }} onClose={() => setPending(null)} className="date-dialog"><form onSubmit={submit} className="p-6">
      <h2 className="font-bold text-xl">{LABEL[pending?.action]}</h2><p className="text-gray-500 text-sm mt-2 break-words">{pending?.name}</p>
      {pending?.action === 'marcar_indicacao_paga' && <><div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm"><p className="text-xs text-gray-500">Chave Pix do indicador</p><p className="font-semibold break-all">{pending.pix || 'Não informada'}</p><CopyButton value={pending.pix} label="Copiar Pix"/></div><label className="text-sm font-semibold block mt-4" htmlFor="admin-paid-on">Data do pagamento</label><input id="admin-paid-on" type="date" required className="input-field mt-2" value={paidOn} max={today()} onChange={e => setPaidOn(e.target.value)}/></>}
      <label className="text-sm font-semibold block mt-4" htmlFor="admin-reason">{pending?.action === 'marcar_indicacao_paga' ? 'Observação do pagamento' : 'Motivo da ação'}</label>
      <textarea id="admin-reason" className="input-field mt-2" rows={3} minLength={5} maxLength={pending?.action?.includes('indica') ? 500 : 1000} required value={reason} onChange={e => setReason(e.target.value)} placeholder={pending?.action === 'marcar_indicacao_paga' ? 'Ex.: Pix enviado, comprovante 1234' : 'Descreva o que foi verificado...'}/>
      <p className="text-xs text-gray-400 mt-2">A ação e o texto ficarão registrados na auditoria.</p>
      <div className="flex gap-3 mt-5"><button type="button" disabled={acting} className="btn-secondary flex-1" onClick={() => dialog.current.close()}>Cancelar</button><button disabled={acting || reason.trim().length < 5} className="btn-primary flex-1">{acting ? 'Salvando...' : 'Confirmar'}</button></div>
    </form></dialog>
  </div></div>
}
