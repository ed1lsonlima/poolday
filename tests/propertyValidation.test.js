import test from 'node:test'
import assert from 'node:assert/strict'
import { propertyFormError } from '../src/lib/propertyValidation.js'
const valid = () => ({ form: { city: 'Maceió', state: 'AL', price_per_day: 100, max_capacity: 10, hora_inicio: 8, hora_fim: 22, description: 'Piscina.', address: 'Rua de teste, 1', map_url: '', rules: '' }, images: ['test.jpg'], amenities: ['Banheiro'], availableDays: [0] })
test('cadastro aceita descrição curta e não exige mapa, referência ou texto de chegada', () => assert.equal(propertyFormError(valid()), null))
test('rascunho no último passo não pode pular dados obrigatórios', () => {
  for (const [field, value, step] of [['city', '', 0], ['price_per_day', '', 1], ['max_capacity', 1.5, 1], ['hora_fim', 8, 1], ['address', '', 3]]) {
    const data = valid(); data.form[field] = value
    assert.equal(propertyFormError(data).step, step)
  }
  const data = valid(); data.images = []; assert.equal(propertyFormError(data).step, 2)
})
test('mantém bloqueio de contatos públicos e valida mapa apenas se preenchido', () => {
  const data = valid(); data.amenities = ['WhatsApp 82999999999']; assert.ok(propertyFormError(data))
  data.amenities = []; data.form.map_url = 'https://example.com'; assert.ok(propertyFormError(data))
})
test('descrição pode ficar vazia, mas a diária deve ter pelo menos sete horas', () => {
  const data = valid(); data.form.description = ''; data.form.rules = ''
  assert.equal(propertyFormError(data), null)
  data.form.hora_fim = 12
  assert.equal(propertyFormError(data).step, 1)
  data.form.hora_fim = 15
  assert.equal(propertyFormError(data), null)
})
