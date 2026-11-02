import test from 'node:test'
import assert from 'node:assert/strict'
import { clearReferralCode, normalizeReferralCode, readReferralCode, referralLink, saveReferralCode } from '../src/lib/referral.js'

function fakeBrowser() {
  const data = new Map()
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }
  const doc = { _c: '', get cookie() { return this._c }, set cookie(v) { this._c = /Max-Age=0/.test(v) ? '' : v.split(';')[0] } }
  return { storage, doc }
}

test('aceita só códigos no formato gerado pelo banco', () => {
  assert.equal(normalizeReferralCode(' AB12cd34 '), 'ab12cd34')
  assert.equal(normalizeReferralCode('abc'), null)
  assert.equal(normalizeReferralCode('<script>'), null)
  assert.equal(normalizeReferralCode('a'.repeat(13)), null)
})

test('guarda o código por 30 dias no armazenamento e no cookie', () => {
  const b = fakeBrowser(); const now = Date.UTC(2026, 9, 31)
  assert.equal(saveReferralCode('ab12cd34', { ...b, now }), 'ab12cd34')
  assert.equal(readReferralCode({ ...b, now: now + 29 * 864e5 }), 'ab12cd34')
  assert.match(b.doc.cookie, /pd_ref=ab12cd34/)
})

test('expira no armazenamento e cai no cookie; limpar remove os dois', () => {
  const b = fakeBrowser(); const now = Date.UTC(2026, 9, 31)
  saveReferralCode('ab12cd34', { ...b, now })
  b.doc._c = ''
  assert.equal(readReferralCode({ ...b, now: now + 31 * 864e5 }), null)
  saveReferralCode('ab12cd34', { ...b, now })
  clearReferralCode(b)
  assert.equal(readReferralCode({ ...b, now }), null)
})

test('código inválido não é guardado', () => {
  const b = fakeBrowser()
  assert.equal(saveReferralCode('x', b), null)
  assert.equal(readReferralCode(b), null)
})

test('link de indicação usa o endereço oficial', () => {
  assert.equal(referralLink('https://www.pooldaybr.com', 'ab12cd34'), 'https://www.pooldaybr.com/i/ab12cd34')
})
