import test from 'node:test'
import assert from 'node:assert/strict'
import { isNoticeForOpenChat, shouldNotifyChatRecipient } from '../src/lib/chatNotifications.js'

const bookingId = '11111111-1111-4111-8111-111111111111'

test('silencia apenas mensagens da conversa que já está aberta', () => {
  const path = `/reserva/${bookingId}/chat`
  assert.equal(isNoticeForOpenChat({ kind: 'chat', booking_id: bookingId }, path), true)
  assert.equal(isNoticeForOpenChat({ kind: 'chat_urgent', action_url: path }, path), true)
  assert.equal(isNoticeForOpenChat({ kind: 'chat', booking_id: '22222222-2222-4222-8222-222222222222' }, path), false)
  assert.equal(isNoticeForOpenChat({ kind: 'booking', booking_id: bookingId }, path), false)
  assert.equal(isNoticeForOpenChat({ kind: 'chat', booking_id: bookingId }, '/reservas'), false)
})

test('não cria aviso de uma mensagem enviada para a própria conta de teste', () => {
  assert.equal(shouldNotifyChatRecipient('usuario-a', 'usuario-a'), false)
  assert.equal(shouldNotifyChatRecipient('usuario-a', 'usuario-b'), true)
})

