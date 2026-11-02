import test from 'node:test'
import assert from 'node:assert/strict'
import { verificationStatus, verificationWhatsappLink, VERIFICATION_STEPS } from '../src/lib/hostVerification.js'
import { canReportNoAccess } from '../src/lib/bookingPolicy.js'
import { adminHome, overdueVerifications } from '../src/lib/adminInbox.js'
import { hostCancellations } from '../src/lib/adminReports.js'

const NOW = Date.parse('2026-11-10T15:00:00Z')

test('verificação: conta os dias e identifica prazo vencido', () => {
  assert.deepEqual(verificationStatus('2026-11-12T15:00:00Z', false, NOW), { state: 'pending', daysLeft: 2 })
  assert.deepEqual(verificationStatus('2026-11-10T16:00:00Z', false, NOW), { state: 'pending', daysLeft: 1 })
  assert.equal(verificationStatus('2026-11-10T15:00:00Z', false, NOW).state, 'overdue')
})

test('verificação: sem prazo ou já verificado não mostra nada', () => {
  assert.equal(verificationStatus(null, false, NOW).state, 'none')
  assert.equal(verificationStatus('2026-11-01T00:00:00Z', true, NOW).state, 'none')
  assert.equal(verificationStatus('data ruim', false, NOW).state, 'none')
})

test('verificação: o link do WhatsApp não leva dados pessoais e o passo a passo pede os 4 itens', () => {
  const link = verificationWhatsappLink()
  assert.match(link, /^https:\/\/wa\.me\/5582996987838\?text=/)
  assert.doesNotMatch(decodeURIComponent(link), /@/)
  assert.equal(VERIFICATION_STEPS.length, 4)
})

test('"Não consegui entrar": vale no dia e até 12h do dia seguinte', () => {
  const booking = { status: 'confirmed', paid_amount: 100, date: '2026-11-10' }
  assert.equal(canReportNoAccess(booking, new Date('2026-11-09T23:00:00-03:00')), false)
  assert.equal(canReportNoAccess(booking, new Date('2026-11-10T08:00:00-03:00')), true)
  assert.equal(canReportNoAccess(booking, new Date('2026-11-11T11:59:00-03:00')), true)
  assert.equal(canReportNoAccess(booking, new Date('2026-11-11T12:00:00-03:00')), false)
})

test('"Não consegui entrar": exige reserva confirmada e paga', () => {
  const now = new Date('2026-11-10T08:00:00-03:00')
  assert.equal(canReportNoAccess({ status: 'pending', paid_amount: 50, date: '2026-11-10' }, now), false)
  assert.equal(canReportNoAccess({ status: 'confirmed', paid_amount: 0, date: '2026-11-10' }, now), false)
})

test('Adm: verificação vencida entra nas pendências, e verificado ou suspenso não', () => {
  const data = {
    users: [{ id: 'a', role: 'host', created_at: '2026-01-01' }, { id: 'b', role: 'host', verified: true, created_at: '2026-01-01' }, { id: 'c', role: 'host', suspended: true, created_at: '2026-01-01' }, { id: 'd', role: 'host', created_at: '2026-01-01' }],
    verifications: [{ host_id: 'a', due_at: '2026-11-01T00:00:00Z' }, { host_id: 'b', due_at: '2026-11-01T00:00:00Z' }, { host_id: 'c', due_at: '2026-11-01T00:00:00Z' }, { host_id: 'd', due_at: '2026-12-01T00:00:00Z' }],
  }
  assert.deepEqual(overdueVerifications(data, NOW).map(item => item.host_id), ['a'])
  assert.equal(adminHome(data, NOW).pendingCount, 1)
  assert.equal(adminHome({ users: data.users }, NOW).pendingCount, 0)
})

test('Adm: conta só cancelamento do anfitrião que devolveu dinheiro', () => {
  assert.equal(hostCancellations([
    { status: 'cancelled', cancelled_by: 'host', refunded_amount: 100 },
    { status: 'cancelled', cancelled_by: 'host', refunded_amount: 0 },
    { status: 'cancelled', cancelled_by: 'client', refunded_amount: 100 },
    { status: 'confirmed', cancelled_by: 'host', refunded_amount: 100 },
  ]), 1)
})
