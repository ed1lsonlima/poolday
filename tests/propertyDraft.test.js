import test from 'node:test'
import assert from 'node:assert/strict'
import { clearPropertyDraft, loadPropertyDraft, propertyDraftKey, savePropertyDraft } from '../src/lib/propertyDraft.js'

test('draft survives a new view and stays tied to its host', () => {
  const data = new Map()
  const storage = { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
  assert.equal(savePropertyDraft(storage, 'host-a', { form: { city: 'Maceió' }, step: 1, images: [], amenities: [], availableDays: [1] }), true)
  assert.equal(loadPropertyDraft(storage, 'host-a').form.city, 'Maceió')
  assert.equal(loadPropertyDraft(storage, 'host-b'), null)
  assert.ok(data.has(propertyDraftKey('host-a')))
  clearPropertyDraft(storage, 'host-a')
  assert.equal(loadPropertyDraft(storage, 'host-a'), null)
})

test('draft save failure is reported instead of pretending it worked', () => {
  assert.equal(savePropertyDraft({ setItem() { throw new Error('quota') } }, 'host', { form: {} }), false)
})
