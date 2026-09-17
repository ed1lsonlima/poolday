import test from 'node:test'
import assert from 'node:assert/strict'
import { csvText, dayBR, inPeriod, report, riskSignals, sum } from '../src/lib/adminReports.js'

test('date ranges include complete local days in Brazil and reject missing dates', () => {
  assert.equal(inPeriod({ created_at: '2026-09-17T02:59:59Z' }, '2026-09-16', '2026-09-16'), true)
  assert.equal(inPeriod({ created_at: '2026-09-17T03:00:00Z' }, '2026-09-16', '2026-09-16'), false)
  assert.equal(inPeriod({ created_at: '2026-09-16' }, '2026-09-16', '2026-09-16'), true)
  assert.equal(inPeriod({ created_at: 'invalid' }, '', ''), false)
  assert.equal(inPeriod({}, '', ''), false)
  assert.equal(dayBR('2026-09-16'), '16/09/2026')
})

test('financial report counts each ledger payment once and excludes refunds and chargebacks from retained volume', () => {
  const stamp = '2026-09-16T12:00:00Z'
  const base = { created_at: stamp, host_id: 'host', amount: 100, refunded_amount: 0, platform_fee: 15, host_net: 80 }
  const data = {
    users: [{ id: 'host', role: 'host', created_at: '2025-01-01T12:00:00Z' }],
    bookings: [{ id: 'b', host_id: 'host', status: 'confirmed', promotion_applied: true, created_at: stamp }, { id: 'p', status: 'pending', hold_expires_at: null, created_at: stamp }],
    payments: [
      { ...base, status: 'approved' },
      { ...base, status: 'approved', refunded_amount: 20 },
      { ...base, status: 'refunded', refunded_amount: 100, platform_fee: 0, host_net: 0 },
      { ...base, status: 'charged_back', platform_fee: 0, host_net: 0 },
      { ...base, status: 'rejected' },
      { ...base, status: 'approved', host_net: null },
      { ...base, status: 'approved', payment_created_at: '2026-09-15T12:00:00Z' },
    ],
  }
  const result = report(data, '2026-09-16', '2026-09-16')
  assert.equal(result.users.length, 0)
  assert.equal(result.payments.length, 6)
  assert.equal(result.gross, 280)
  assert.equal(result.paidGross, 500)
  assert.equal(result.fees, 30)
  assert.equal(result.refunds, 120)
  assert.equal(result.chargebacks, 100)
  assert.equal(result.needsReconciliation, 2)
  assert.equal(result.hosts[0].net, 80)
  assert.equal(result.hosts[0].promo, 1)
  assert.equal(result.hosts[0].needsReconciliation, 2)
  assert.equal(result.expired.length, 0)
})

test('money totals use integer cents and incomplete datasets do not crash', () => {
  assert.equal(sum([{ n: 0.1 }, { n: 0.2 }], 'n'), 0.3)
  assert.equal(report({}).gross, 0)
  assert.deepEqual(riskSignals({}), [])
})

test('CSV exports quote content and neutralize spreadsheet formulas', () => {
  const csv = csvText([{ nome: '=HYPERLINK("bad")', cidade: 'Maceió;AL' }])
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'))
  assert.ok(csv.includes('"Maceió;AL"'))
  assert.equal(csvText([]), '')
})
