import test from 'node:test'
import assert from 'node:assert/strict'
import { adminHome, flaggedChats, referralTotals, resolveAdminTab, splitEvents } from '../src/lib/adminInbox.js'

const now = Date.parse('2026-10-31T12:00:00Z')

test('avisos informativos vão para o sino e não contam como pendência', () => {
  const events = [
    { id: 1, kind: 'signup', severity: 'info', title: 'Novo cadastro' },
    { id: 2, kind: 'booking', severity: 'info', title: 'Nova tentativa de reserva' },
    { id: 3, kind: 'booking_status', severity: 'info', title: 'Reserva cancelada ou expirada' },
    { id: 4, kind: 'payment_conflict', severity: 'urgent', title: 'Pagamento requer conciliação', entity_id: 'b1' },
    { id: 5, kind: 'contact', severity: 'review', title: 'Possível contato externo no anúncio' },
    { id: 6, kind: 'payment', severity: 'review', resolved_at: '2026-10-30T00:00:00Z' },
  ]
  const { alerts, notices } = splitEvents(events)
  assert.deepEqual(alerts.map(e => e.id), [4, 5])
  assert.deepEqual(notices.map(e => e.id), [1, 2, 3])
  const home = adminHome({ events, users: [], properties: [] }, now)
  assert.equal(home.pendingCount, 2)
  assert.equal(home.problemBookings, 1)
})

test('conversas sinalizadas somem depois de consultadas (consulta registrada na auditoria)', () => {
  const chatReports = [{ booking_id: 'b1', created_at: '2026-10-30T10:00:00Z' }]
  const chatModeration = [{ booking_id: 'b2', created_at: '2026-10-30T11:00:00Z' }, { booking_id: 'b2', created_at: '2026-10-30T12:00:00Z' }]
  assert.deepEqual(flaggedChats({ chatReports, chatModeration }).map(f => [f.bookingId, f.reports, f.blocked]), [['b2', 0, 2], ['b1', 1, 0]])
  const audit = [{ action: 'view_booking_chat', entity_id: 'b2', created_at: '2026-10-30T13:00:00Z' }]
  assert.deepEqual(flaggedChats({ chatReports, chatModeration, audit }).map(f => f.bookingId), ['b1'])
})

test('números do início: anfitriões da semana, espaços para aprovar e indicações a pagar', () => {
  const data = {
    users: [{ role: 'host', created_at: '2026-10-29T00:00:00Z' }, { role: 'host', created_at: '2026-10-01T00:00:00Z' }, { role: 'client', created_at: '2026-10-30T00:00:00Z' }],
    properties: [{ id: 'p2', moderation_status: 'pending', created_at: '2026-10-30T00:00:00Z' }, { id: 'p1', moderation_status: 'pending', created_at: '2026-10-20T00:00:00Z' }, { id: 'p3', moderation_status: 'approved' }],
    referrals: [{ status: 'a_pagar', valor_centavos: 2000 }, { status: 'a_pagar', valor_centavos: 2000 }, { status: 'paga', valor_centavos: 2000 }],
    events: [],
  }
  const home = adminHome(data, now)
  assert.equal(home.newHostsWeek, 1)
  assert.deepEqual(home.waiting.map(p => p.id), ['p1', 'p2'])
  assert.equal(home.referralsToPay, 4000)
  assert.equal(home.pendingCount, 4)
  assert.deepEqual(referralTotals(data.referrals), { toPay: 4000, paid: 2000, toPayCount: 2 })
})

test('programa ainda não ativado não quebra o painel', () => {
  assert.deepEqual(referralTotals(null), { toPay: 0, paid: 0, toPayCount: 0 })
  assert.equal(adminHome({ referrals: null }, now).referralsToPay, 0)
})

test('links antigos das abas continuam funcionando', () => {
  assert.equal(resolveAdminTab('properties'), 'properties')
  assert.equal(resolveAdminTab('finance'), 'bookings')
  assert.equal(resolveAdminTab('chats'), 'bookings')
  assert.equal(resolveAdminTab('regions'), 'users')
  assert.equal(resolveAdminTab('alerts'), 'records')
  assert.equal(resolveAdminTab('audit'), 'records')
  assert.equal(resolveAdminTab('qualquer'), 'overview')
})
