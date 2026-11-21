import test from 'node:test'
import assert from 'node:assert/strict'
import { buildVisit, campaignFrom, deviceType, geoFromCookie, isBot, referrerHost } from '../src/lib/visitTracking.js'
import { nomeOrigem, nomePagina, quando, taxaCadastro } from '../src/painel/painelData.js'

function memoryStorage() {
  const data = new Map()
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) }
}
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'

test('visitas: identifica o tipo de aparelho e ignora robôs', () => {
  assert.equal(deviceType(iphone), 'celular')
  assert.equal(deviceType('Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 Safari/537.36'), 'tablet')
  assert.equal(deviceType('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130'), 'computador')
  assert.equal(isBot('Googlebot/2.1'), true)
  assert.equal(isBot('WhatsApp/2.23'), true)
  assert.equal(isBot(iphone, true), true)
  assert.equal(isBot(iphone), false)
})

test('visitas: origem ignora o próprio site e guarda a campanha', () => {
  assert.equal(referrerHost('https://l.instagram.com/?u=x', 'www.pooldaybr.com'), 'l.instagram.com')
  assert.equal(referrerHost('https://www.pooldaybr.com/explorar', 'www.pooldaybr.com'), null)
  assert.equal(referrerHost('', 'www.pooldaybr.com'), null)
  assert.deepEqual(campaignFrom('?utm_source=tiktok&utm_campaign=anfitrioes'), { utm_source: 'tiktok', utm_medium: null, utm_campaign: 'anfitrioes' })
})

test('visitas: lê a cidade aproximada sem quebrar com cookie ruim', () => {
  assert.deepEqual(geoFromCookie(`pd_geo=${encodeURIComponent('Macei%C3%B3|AL|BR')}`), { city: 'Maceió', region: 'AL' })
  assert.deepEqual(geoFromCookie('outro=1'), { city: null, region: null })
  assert.deepEqual(geoFromCookie(`pd_geo=${encodeURIComponent('Lisbon|11|PT')}`), { city: 'Lisbon (PT)', region: null })
})

test('visitas: mesma sessão por 30 minutos, nova depois disso', () => {
  const storage = memoryStorage()
  const env = (now, search = '') => ({ path: '/', storage, now, win: { location: { search, hostname: 'www.pooldaybr.com' } }, doc: { referrer: 'https://www.tiktok.com/', cookie: '' }, nav: { userAgent: iphone } })
  const first = buildVisit(env(0, '?utm_source=tiktok'))
  const second = buildVisit(env(10 * 60 * 1000))
  const third = buildVisit(env(50 * 60 * 1000))
  assert.equal(first.session_id, second.session_id)
  assert.equal(second.utm_source, 'tiktok')
  assert.notEqual(third.session_id, first.session_id)
  assert.equal(third.visitor_id, first.visitor_id)
  assert.equal(first.device, 'celular')
  assert.equal(first.referrer_host, 'tiktok.com')
})

test('visitas: respeita quem pede para não ser rastreado', () => {
  assert.equal(buildVisit({ path: '/', storage: memoryStorage(), win: { location: { search: '', hostname: 'x' } }, doc: { referrer: '', cookie: '' }, nav: { userAgent: iphone, doNotTrack: '1' } }), null)
})

test('painel: nomes simples para páginas e origens', () => {
  assert.equal(nomePagina('/'), 'Página inicial')
  assert.equal(nomePagina('/espaco/abc'), 'Página de um espaço')
  assert.equal(nomePagina('/qualquer'), '/qualquer')
  assert.equal(nomeOrigem('instagram'), 'Instagram')
  assert.equal(nomeOrigem('l.facebook.com'), 'l.facebook.com')
})

test('painel: taxa de cadastro e tempo relativo', () => {
  assert.equal(taxaCadastro(0, 3), null)
  assert.equal(taxaCadastro(200, 3), 1.5)
  const agora = Date.parse('2026-11-21T15:00:00Z')
  assert.equal(quando('2026-11-21T14:59:40Z', agora), 'agora')
  assert.equal(quando('2026-11-21T14:20:00Z', agora), 'há 40 min')
  assert.equal(quando('2026-11-21T10:00:00Z', agora), 'há 5 h')
})
