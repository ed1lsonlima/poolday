import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { indiqueHtml } from '../vite.config.js'

test('a página /indique tem título e prévia próprios para o WhatsApp', () => {
  const html = indiqueHtml(readFileSync(new URL('../index.html', import.meta.url), 'utf8').replaceAll('__SITE_URL__', 'https://www.pooldaybr.com'), 'https://www.pooldaybr.com')
  assert.match(html, /<title>Indique um anfitrião: R\$ 30 quando o espaço for aprovado — PoolDay<\/title>/)
  assert.match(html, /og:title" content="Indique um anfitrião: R\$ 30 quando o espaço for aprovado/)
  assert.match(html, /og:description" content="[^"]*cadastrado completo e aprovado/)
  assert.match(html, /og:url" content="https:\/\/www\.pooldaybr\.com\/indique"/)
  assert.match(html, /canonical" href="https:\/\/www\.pooldaybr\.com\/indique"/)
})
