import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { trackHostLead, trackHostRegistration } from '../src/lib/tiktokPixel.js'

function signup(id) {
  return { user: { id, identities: [{ provider: 'email' }], email: 'private@example.com' } }
}

test('pixel loads once with the supplied ID and queues the initial page view', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('ttq.load'))
  assert.ok(script)
  for (const hostname of ['www.pooldaybr.com', 'pooldaybr.com', 'localhost', 'preview.vercel.app']) {
    const inserted = []
    const window = { location: { hostname } }
    const document = { createElement: () => ({}), getElementsByTagName: () => [{ parentNode: { insertBefore: element => inserted.push(element) } }] }
    vm.runInNewContext(script, { window, document })
    if (hostname.endsWith('pooldaybr.com')) {
      assert.equal(inserted.length, 1)
      assert.equal(inserted[0].src, 'https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=DB8OGBRC77UAEK318GUG&lib=ttq')
      assert.equal(window.ttq.length, 1)
      assert.equal(window.ttq[0][0], 'page')
    } else {
      assert.equal(inserted.length, 0)
      assert.equal(window.ttq, undefined)
    }
  }
})

test('host events omit personal data and deduplicate successful registration', () => {
  const calls = []
  globalThis.window = { ttq: { track: (...args) => calls.push(args) } }
  try {
    assert.equal(trackHostLead(), true)
    assert.equal(trackHostRegistration(signup('host-1'), 'host'), true)
    assert.equal(trackHostRegistration(signup('host-1'), 'host'), false)
    assert.deepEqual(calls, [['SubmitForm'], ['CompleteRegistration']])
  } finally { delete globalThis.window }
})

test('clients, failed signup and obfuscated existing users are not host registrations', () => {
  const calls = []
  globalThis.window = { ttq: { track: (...args) => calls.push(args) } }
  try {
    for (const result of [undefined, {}, { user: { id: 'existing', identities: [] } }, { ...signup('failed'), error: new Error('rejected') }]) {
      assert.equal(trackHostRegistration(result, 'host'), false)
    }
    assert.equal(trackHostRegistration(signup('client'), 'client'), false)
    assert.deepEqual(calls, [])
  } finally { delete globalThis.window }
})

test('blocked SDK never breaks the funnel or consumes the registration deduplication', () => {
  assert.equal(trackHostLead(), false)
  globalThis.window = { ttq: { track: () => { throw new Error('blocked') } } }
  try {
    assert.equal(trackHostLead(), false)
    assert.equal(trackHostRegistration(signup('retry'), 'host'), false)
    window.ttq.track = () => {}
    assert.equal(trackHostRegistration(signup('retry'), 'host'), true)
  } finally { delete globalThis.window }
})
