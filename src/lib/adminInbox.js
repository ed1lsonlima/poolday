// Organização do painel: o que exige ação (pendências) e o que é só aviso (sino).

export const ADMIN_TABS = ['overview', 'properties', 'users', 'bookings', 'referrals', 'records']
// Links antigos (?tab=...) continuam abrindo a seção certa.
const TAB_ALIASES = { finance: 'bookings', chats: 'bookings', regions: 'users', alerts: 'records', audit: 'records' }
export const resolveAdminTab = value => ADMIN_TABS.includes(value) ? value : TAB_ALIASES[value] || 'overview'

const PAYMENT_KINDS = new Set(['payment', 'payment_conflict'])
const WEEK = 7 * 24 * 60 * 60 * 1000

// Avisos com severidade "info" (novo cadastro, nova tentativa de reserva, reserva cancelada ou expirada,
// pagamento confirmado, espaço enviado) vão para o sino e não contam como pendência.
export const isInfoEvent = event => (event.severity || 'info') === 'info'

export function splitEvents(events = []) {
  const open = events.filter(event => !event.resolved_at)
  return { alerts: open.filter(event => !isInfoEvent(event)), notices: open.filter(isInfoEvent) }
}

// Conversas com denúncia ou tentativa de contato externo bloqueada depois da última consulta registrada.
export function flaggedChats({ chatReports = [], chatModeration = [], audit = [] } = {}) {
  const lastView = new Map()
  for (const item of audit) if (item.action === 'view_booking_chat') {
    const time = Date.parse(item.created_at)
    if (!(lastView.get(item.entity_id) >= time)) lastView.set(item.entity_id, time)
  }
  const flags = new Map()
  for (const [list, type] of [[chatReports, 'reports'], [chatModeration, 'blocked']]) for (const item of list) {
    const time = Date.parse(item.created_at)
    if (lastView.get(item.booking_id) >= time) continue
    const flag = flags.get(item.booking_id) || { bookingId: item.booking_id, reports: 0, blocked: 0, latest: 0 }
    flag[type]++; flag.latest = Math.max(flag.latest, time)
    flags.set(item.booking_id, flag)
  }
  return [...flags.values()].sort((a, b) => b.latest - a.latest)
}

export function referralTotals(referrals) {
  const list = referrals || []
  const cents = status => list.filter(item => item.status === status).reduce((total, item) => total + Number(item.valor_centavos || 0), 0)
  return { toPay: cents('a_pagar'), paid: cents('paga'), toPayCount: list.filter(item => item.status === 'a_pagar').length }
}

// Anfitriões sem verificação depois do prazo: o espaço já não recebe novas reservas.
export function overdueVerifications(data, now = Date.now()) {
  const users = new Map((data.users || []).map(user => [user.id, user]))
  return (data.verifications || []).filter(item => Date.parse(item.due_at) <= now && users.has(item.host_id) && !users.get(item.host_id).verified && !users.get(item.host_id).suspended)
    .map(item => ({ ...item, user: users.get(item.host_id) }))
}

export function adminHome(data, now = Date.now()) {
  const { alerts } = splitEvents(data.events)
  const waiting = (data.properties || []).filter(property => property.moderation_status === 'pending')
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  const chats = flaggedChats(data)
  const paymentAlerts = alerts.filter(event => PAYMENT_KINDS.has(event.kind))
  const problemBookings = new Set([...paymentAlerts.map(event => event.entity_id), ...chats.map(flag => flag.bookingId)])
  const toPay = (data.referrals || []).filter(item => item.status === 'a_pagar')
  const otherAlerts = alerts.filter(event => !PAYMENT_KINDS.has(event.kind))
  const overdue = overdueVerifications(data, now)
  return {
    newHostsWeek: (data.users || []).filter(user => user.role === 'host' && now - Date.parse(user.created_at) <= WEEK).length,
    waiting,
    problemBookings: problemBookings.size,
    referralsToPay: referralTotals(data.referrals).toPay,
    chats, paymentAlerts, toPay, otherAlerts, overdue,
    pendingCount: waiting.length + chats.length + paymentAlerts.length + toPay.length + otherAlerts.length + overdue.length,
  }
}
