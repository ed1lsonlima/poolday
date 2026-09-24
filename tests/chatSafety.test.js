import test from 'node:test'
import assert from 'node:assert/strict'
import { bookingChatWritable, externalContactReason } from '../src/lib/chatSafety.js'

test('chat is unavailable before payment and read-only after cancellation', () => {
  assert.equal(bookingChatWritable({ status: 'pending', paid_amount: 0, payment_state: 'awaiting_first_payment' }), false)
  assert.equal(bookingChatWritable({ status: 'pending', paid_amount: 150, payment_state: 'deposit_paid' }), true)
  assert.equal(bookingChatWritable({ status: 'confirmed', paid_amount: 300, payment_state: 'fully_paid' }), true)
  assert.equal(bookingChatWritable({ status: 'cancelled', paid_amount: 150, payment_state: 'refunded' }), false)
})

test('contact attempts are blocked without blocking ordinary arrival details', () => {
  for (const message of ['Me chama no WhatsApp', 'Veja instagram.com/piscina', 'Meu número é (82) 99999-9999', 'Perfil @piscina']) {
    assert.ok(externalContactReason(message), message)
  }
  for (const message of ['O portão é azul e fica depois da igreja.', 'Vou chegar às 14h.', 'O número do portão é 42.']) {
    assert.equal(externalContactReason(message), null, message)
  }
})

