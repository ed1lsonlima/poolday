import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePaymentReturnOrigin } from '../api/_lib/paymentReturnOrigin.js'

const siteUrl = 'https://www.pooldaybr.com'

test('retorna ao mesmo endereço em que o cliente iniciou o pagamento', () => {
  assert.equal(resolvePaymentReturnOrigin({ headers: { origin: 'https://poolday-self.vercel.app', host: 'poolday-self.vercel.app' } }, siteUrl), 'https://poolday-self.vercel.app')
  assert.equal(resolvePaymentReturnOrigin({ headers: { origin: 'https://pooldaybr.com', host: 'pooldaybr.com' } }, siteUrl), 'https://pooldaybr.com')
})

test('não permite usar o retorno como redirecionamento para outro site', () => {
  assert.equal(resolvePaymentReturnOrigin({ headers: { origin: 'https://pooldaybr.com.evil.example', host: 'pooldaybr.com.evil.example' } }, siteUrl), siteUrl)
  assert.equal(resolvePaymentReturnOrigin({ headers: { origin: 'http://pooldaybr.com', host: 'evil.example' } }, siteUrl), siteUrl)
})

test('usa o host validado se o navegador não enviar Origin', () => {
  assert.equal(resolvePaymentReturnOrigin({ headers: { host: 'poolday-self.vercel.app' } }, siteUrl), 'https://poolday-self.vercel.app')
})

