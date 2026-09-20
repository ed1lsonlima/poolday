const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export function localDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Maceio', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const get = type => parts.find(part => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function calendarDaysUntil(date, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return Number.NaN
  const [year, month, day] = date.split('-').map(Number)
  const [todayYear, todayMonth, todayDay] = localDateKey(now).split('-').map(Number)
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / DAY_MS)
}

export function paymentPlanForDate(date, totalAmount, now = new Date()) {
  const days = calendarDaysUntil(date, now)
  const total = roundMoney(totalAmount)
  const depositPlan = days >= 8
  const dueNow = depositPlan ? roundMoney(total / 2) : total
  const holdMinutes = days >= 8 ? 24 * 60 : days >= 4 ? 120 : days >= 1 ? 30 : 15
  return {
    days,
    paymentPlan: depositPlan ? 'deposit' : 'full',
    dueNow,
    remaining: roundMoney(total - dueNow),
    holdMinutes,
  }
}

export function calculateCancellation({ totalAmount, paidAmount, createdAt, serviceStartsAt, now = new Date(), cancelledBy = 'client' }) {
  const total = roundMoney(totalAmount)
  const paid = Math.max(0, Math.min(total, roundMoney(paidAmount)))
  const created = new Date(createdAt)
  const service = new Date(serviceStartsAt)
  const current = new Date(now)
  const hoursUntilService = (service.getTime() - current.getTime()) / HOUR_MS

  if (!Number.isFinite(service.getTime()) || hoursUntilService <= 0) {
    return { canCancel: false, reason: 'A diária já começou. Fale com o suporte PoolDay.', refundAmount: 0, retainedAmount: paid, retentionRate: 1, freeCancellation: false }
  }

  if (paid === 0) {
    return { canCancel: true, refundAmount: 0, retainedAmount: 0, retentionRate: 0, freeCancellation: true, hoursUntilService }
  }

  const coolingOff = Number.isFinite(created.getTime()) && current.getTime() <= created.getTime() + 7 * DAY_MS
  const freeCancellation = cancelledBy === 'host' || coolingOff || hoursUntilService > 7 * 24
  const retentionRate = freeCancellation ? 0 : hoursUntilService >= 72 ? 0.25 : 0.5
  const retainedAmount = Math.min(paid, roundMoney(total * retentionRate))
  const refundAmount = roundMoney(paid - retainedAmount)

  return { canCancel: true, refundAmount, retainedAmount, retentionRate, freeCancellation, coolingOff, hoursUntilService }
}

