import test from 'node:test'
import assert from 'node:assert/strict'
import { paymentExpiration } from '../api/_lib/paymentExpiry.js'

test('checkout usa a data devolvida pelo RPC, sem exigir hold_expires_at', () => {
  assert.equal(paymentExpiration({ payment_expires_at: '2026-10-10T12:00:00Z' }), '2026-10-10T12:00:00.000Z')
})
test('saldo usa seu próprio prazo, não o bloqueio da entrada', () => {
  assert.equal(paymentExpiration({ payment_expires_at: '2026-10-18T08:00:00-03:00', hold_expires_at: '2026-10-04T12:00:00Z' }), '2026-10-18T11:00:00.000Z')
})
test('checkout rejeita vencimento ausente ou inválido', () => {
  for (const value of [undefined, null, '', 'invalid', 0]) assert.throws(() => paymentExpiration({ payment_expires_at: value }), /INVALID_PAYMENT_EXPIRATION/)
})
