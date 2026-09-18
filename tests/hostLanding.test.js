import test from 'node:test'
import assert from 'node:assert/strict'
import {
  HOST_SIGNUP_PREFILL_KEY,
  calculateHostEarnings,
  readHostSignupPrefill,
  saveHostSignupPrefill,
} from '../src/lib/hostLanding.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

test('simulator applies zero fee only to the first three reservations', () => {
  assert.deepEqual(calculateHostEarnings(350, 8), { monthly: 2537.5, yearly: 28717.5 })
  assert.deepEqual(calculateHostEarnings(350, 3), { monthly: 1050, yearly: 10867.5 })
})

test('host prefill is sanitized, versioned and expires after 24 hours', () => {
  const storage = memoryStorage()
  const now = Date.UTC(2026, 8, 18)

  saveHostSignupPrefill(storage, {
    name: '  Maria da Silva  ',
    phone: '(82) 99999-9999',
    city: ' Maceió ',
    propertyType: 'Piscina',
  }, now)

  assert.equal(JSON.parse(storage.getItem(HOST_SIGNUP_PREFILL_KEY)).version, 1)
  assert.deepEqual(readHostSignupPrefill(storage, now + 1_000), {
    name: 'Maria da Silva',
    phone: '82999999999',
    city: 'Maceió',
    propertyType: 'Piscina',
  })
  assert.equal(readHostSignupPrefill(storage, now + (25 * 60 * 60 * 1000)), null)
})
