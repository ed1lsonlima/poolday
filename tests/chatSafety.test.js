import test from 'node:test'
import assert from 'node:assert/strict'
import { bookingChatWritable, externalContactReason, fragmentedContactReason } from '../src/lib/chatSafety.js'

test('chat is unavailable before payment and read-only after cancellation', () => {
  assert.equal(bookingChatWritable({ status: 'pending', paid_amount: 0, payment_state: 'awaiting_first_payment' }), false)
  assert.equal(bookingChatWritable({ status: 'pending', paid_amount: 150, payment_state: 'deposit_paid' }), true)
  assert.equal(bookingChatWritable({ status: 'confirmed', paid_amount: 300, payment_state: 'fully_paid' }), true)
  assert.equal(bookingChatWritable({ status: 'cancelled', paid_amount: 150, payment_state: 'refunded' }), false)
})

test('contact attempts are blocked without blocking ordinary arrival details', () => {
  for (const message of ['Me chama no WhatsApp', 'Veja instagram.com/piscina', 'Meu número é (82) 99999-9999', 'Perfil @piscina', '8 2 99  9257494', '82.99925.7494', 'oito dois nove nove nove dois cinco sete quatro nove quatro', '8a2a99a9257494', 'w h a t s a p p', 'inst4gram', 'nome arroba gmail ponto com', 'meu celular', 'chave pix']) {
    assert.ok(externalContactReason(message), message)
  }
  for (const message of ['O portão é azul e fica depois da igreja.', 'Vou chegar às 14h.', 'O número do portão é 42.', 'A reserva é dia 09/10/2026.', 'Tenho 8 crianças e 2 adultos.']) {
    assert.equal(externalContactReason(message), null, message)
  }
})

test('bloqueia telefone repartido em várias mensagens numéricas', () => {
  assert.equal(fragmentedContactReason('9257494', ['99', '2', '8']), 'telefone fragmentado')
  assert.equal(fragmentedContactReason('9257494', ['O portão é 82', '99', '2', '8']), null)
})

