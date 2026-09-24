import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPublicPropertyTitle, containsExternalContact, isTrustedMapLink, publicFirstName } from '../src/lib/propertySafety.js'

test('gera título público a partir de características estruturadas', () => {
  assert.equal(buildPublicPropertyTitle({
    type: 'pool', city: 'Maceió', neighborhood: 'Ponta Verde', amenities: ['Churrasqueira', 'Deck', 'Wi-Fi'],
  }), 'Piscina com churrasqueira e deck em Ponta Verde, Maceió')
})

test('identifica tentativas comuns de contato externo', () => {
  assert.equal(containsExternalContact('me chama no insta'), true)
  assert.equal(containsExternalContact('WhatsApp 82999999999'), true)
  assert.equal(containsExternalContact('Espaço com jardim e estacionamento'), false)
})

test('aceita apenas links privados de mapas conhecidos', () => {
  assert.equal(isTrustedMapLink('https://maps.app.goo.gl/abc123'), true)
  assert.equal(isTrustedMapLink('https://www.google.com/maps/place/teste'), true)
  assert.equal(isTrustedMapLink('https://instagram.com/espaco'), false)
})

test('perfil público mostra somente o primeiro nome', () => {
  assert.equal(publicFirstName('Maria da Silva'), 'Maria')
  assert.equal(publicFirstName('@piscina_maria'), 'Anfitrião')
})
