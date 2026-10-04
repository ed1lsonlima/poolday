import test from 'node:test'
import assert from 'node:assert/strict'
import { filterCities } from '../src/lib/citySearch.js'

const cities = [{ nome: 'Maceió' }, { nome: 'Palmeira dos Índios' }, { nome: 'Maragogi' }]

test('city search ignores accents and respects the result limit', () => {
  assert.deepEqual(filterCities(cities, 'maceio'), [cities[0]])
  assert.deepEqual(filterCities(cities, 'mar', 1), [cities[2]])
  assert.deepEqual(filterCities(cities, '', 2), cities.slice(0, 2))
})
