import test from 'node:test'
import assert from 'node:assert/strict'
import { hostPayout, listedPriceForPayout } from '../src/lib/hostPricing.js'

test('R$500 anunciados geram R$425 após a promoção', () => {
  assert.equal(hostPayout(500), 425)
})

test('sugestão permite receber o valor desejado após a taxa', () => {
  assert.equal(listedPriceForPayout(500), 588.23)
  assert.equal(hostPayout(588.23), 500)
  for (const wanted of [30, 50, 100, 199.99, 850]) {
    const suggested = listedPriceForPayout(wanted)
    assert.ok(hostPayout(suggested) >= wanted)
    assert.ok(hostPayout(suggested - 0.01) < wanted)
  }
})

