import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePaymentReturnOrigin } from '../api/_lib/paymentReturnOrigin.js'

const siteUrl = 'https://www.pooldaybr.com'

test('retorna ao domínio oficial, onde fica a sessão do cliente', () => {
  assert.equal(resolvePaymentReturnOrigin({ headers: { origin: 'https://www.pooldaybr.com', host: 'www.pooldaybr.com' } }, siteUrl), siteUrl)
})

test('endereços antigos voltam para o domínio oficial', () => {
  assert.equal(resolvePaymentReturnOrigin({ headers: { origin: 'https://poolday-self.vercel.app', host: 'poolday-self.vercel.app' } }, siteUrl), siteUrl)
  assert.equal(resolvePaymentReturnOrigin({ headers: { origin: 'https://pooldaybr.com', host: 'pooldaybr.com' } }, siteUrl), siteUrl)
  assert.equal(resolvePaymentReturnOrigin({ headers: { host: 'poolday-self.vercel.app' } }, siteUrl), siteUrl)
})

test('não permite usar o retorno como redirecionamento para outro site', () => {
  assert.equal(resolvePaymentReturnOrigin({ headers: { origin: 'https://pooldaybr.com.evil.example', host: 'pooldaybr.com.evil.example' } }, siteUrl), siteUrl)
  assert.equal(resolvePaymentReturnOrigin({ headers: { origin: 'http://pooldaybr.com', host: 'evil.example' } }, siteUrl), siteUrl)
})
