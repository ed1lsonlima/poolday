import test from 'node:test'
import assert from 'node:assert/strict'
import { isNearChatBottom } from '../src/lib/chatScroll.js'

test('acompanha mensagens quando o leitor está perto do fim', () => {
  assert.equal(isNearChatBottom({ scrollHeight: 600, scrollTop: 320, clientHeight: 200 }), true)
})

test('não move a conversa enquanto o leitor vê mensagens antigas', () => {
  assert.equal(isNearChatBottom({ scrollHeight: 600, scrollTop: 100, clientHeight: 200 }), false)
})

