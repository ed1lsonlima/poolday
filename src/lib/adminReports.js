const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0
const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' })
export const money = value => numeric(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const dayBR = value => {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' })
}
export const paymentDate = row => row.payment_created_at || row.created_at
export const inPeriod = (row, from, to, dateField = 'created_at') => {
  const value = typeof dateField === 'function' ? dateField(row) : row[dateField]
  if (!value) return false
  const date = new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value)
  if (Number.isNaN(date.getTime())) return false
  const parts = Object.fromEntries(localDay.formatToParts(date).map(part => [part.type, part.value]))
  const day = `${parts.year}-${parts.month}-${parts.day}`
  return (!from || day >= from) && (!to || day <= to)
}
export const sum = (rows, key) => rows.reduce((total, row) => total + Math.round(numeric(row[key]) * 100), 0) / 100
export const retainedPayment = row => row.status === 'approved' ? Math.max(0, Math.round((numeric(row.amount) - numeric(row.refunded_amount)) * 100) / 100) : 0

export function report(data, from = '', to = '') {
  const users = (data.users || []).filter(r => inPeriod(r, from, to))
  const bookings = (data.bookings || []).filter(r => inPeriod(r, from, to))
  const payments = (data.payments || []).filter(r => inPeriod(r, from, to, paymentDate))
  const approved = payments.filter(p => p.status === 'approved')
  // Partial refunds require manual fee reconciliation; never label the old fee as settled income.
  const settled = approved.filter(p => !Number(p.refunded_amount))
  const expired = bookings.filter(b => b.status === 'pending' && b.hold_expires_at && new Date(b.hold_expires_at) < new Date())
  const hosts = (data.users || []).filter(u => u.role === 'host').map(host => {
    const list = approved.filter(p => p.host_id === host.id)
    const reconciled = list.filter(p => !numeric(p.refunded_amount) && p.host_net != null)
    const all = (data.bookings || []).filter(b => b.host_id === host.id)
    return { ...host, gross: sum(list.map(p => ({ retained: retainedPayment(p) })), 'retained'), fees: sum(list.filter(p => !numeric(p.refunded_amount)), 'platform_fee'), net: sum(reconciled, 'host_net'), paid: list.length, needsReconciliation: list.length - reconciled.length, promo: all.filter(b => b.promotion_applied && ['confirmed','completed'].includes(b.status)).length }
  }).sort((a, b) => b.gross - a.gross)
  return { users, bookings, payments, approved, settled, expired, hosts,
    gross: sum(approved.map(p => ({ retained: retainedPayment(p) })), 'retained'), fees: sum(settled, 'platform_fee'),
    paidGross: sum(payments.filter(p => ['approved', 'refunded', 'charged_back'].includes(p.status)), 'amount'),
    refunds: sum(payments, 'refunded_amount'), chargebacks: sum(payments.filter(p => p.status === 'charged_back'), 'amount'),
    needsReconciliation: approved.filter(p => Number(p.refunded_amount)>0 || p.host_net == null).length,
  }
}

export function riskSignals(data) {
  const signals = []
  const phones = new Map()
  const cancellations = new Map()
  for (const booking of data.bookings || []) if (booking.status === 'cancelled') cancellations.set(booking.client_id, (cancellations.get(booking.client_id) || 0) + 1)
  for (const user of data.users || []) {
    const phone = (user.phone || '').replace(/\D/g, '')
    if (phone.length >= 10) phones.set(phone, [...(phones.get(phone) || []), user])
    const cancelled = cancellations.get(user.id) || 0
    if (cancelled >= 3) signals.push({ id: `cancel:${user.id}`, title: `${user.name}: ${cancelled} reservas canceladas`, detail: 'Pode incluir reservas expiradas. Conferir contexto antes de agir.' })
  }
  for (const group of phones.values()) if (group.length > 1) signals.push({ id: `phone:${group[0].id}`, title: 'Telefone repetido em cadastros', detail: group.map(u => u.name).join(', ') + '. Pode ser um contato familiar compartilhado.' })
  return signals
}

export function csvText(rows) {
  if (!rows.length) return ''
  const columns = Object.keys(rows[0])
  const cell = value => { let text = String(value ?? ''); if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"` }
  return '\uFEFF' + [columns, ...rows.map(row => columns.map(key => row[key]))].map(row => row.map(cell).join(';')).join('\r\n')
}

export function downloadCSV(rows, name) {
  const url = URL.createObjectURL(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a'); link.href = url; link.download = `poolday-${name}.csv`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
