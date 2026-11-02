import test from 'node:test'
import assert from 'node:assert/strict'
import { authRedirectOrigin, DEFAULT_SITE_URL, normalizeSiteUrl, robotsTxt, sitemapXml } from '../src/lib/siteUrl.js'
import vercel from '../vercel.json' with { type: 'json' }

test('endereço padrão é o domínio oficial e ignora valores inválidos ou antigos', () => {
  assert.equal(normalizeSiteUrl(undefined), DEFAULT_SITE_URL)
  assert.equal(normalizeSiteUrl('https://www.pooldaybr.com/'), 'https://www.pooldaybr.com')
  assert.equal(normalizeSiteUrl('https://poolday-self.vercel.app'), DEFAULT_SITE_URL)
  assert.equal(normalizeSiteUrl('http://www.pooldaybr.com'), DEFAULT_SITE_URL)
  assert.equal(normalizeSiteUrl('lixo'), DEFAULT_SITE_URL)
})

test('login em produção e nos endereços antigos volta para o domínio oficial', () => {
  for (const hostname of ['www.pooldaybr.com', 'pooldaybr.com', 'poolday-self.vercel.app']) {
    assert.equal(authRedirectOrigin({ hostname, origin: `https://${hostname}` }), DEFAULT_SITE_URL)
  }
})

test('localhost e previews da Vercel continuam no próprio endereço', () => {
  assert.equal(authRedirectOrigin({ hostname: 'localhost', origin: 'http://localhost:5173' }), 'http://localhost:5173')
  assert.equal(authRedirectOrigin({ hostname: 'poolday-git-feat-abc.vercel.app', origin: 'https://poolday-git-feat-abc.vercel.app' }), 'https://poolday-git-feat-abc.vercel.app')
})

test('sitemap e robots usam o mesmo endereço', () => {
  assert.match(sitemapXml(), /<loc>https:\/\/www\.pooldaybr\.com\/seja-anfitriao<\/loc>/)
  assert.ok(!sitemapXml().includes('vercel.app'))
  assert.match(robotsTxt(), /Sitemap: https:\/\/www\.pooldaybr\.com\/sitemap\.xml/)
  assert.match(robotsTxt(), /Disallow: \/admin/)
})

test('poolday-self redireciona para o domínio oficial sem afetar as APIs nem os previews', () => {
  const rule = vercel.redirects.find(item => item.has?.some(has => has.type === 'host' && has.value === 'poolday-self.vercel.app'))
  assert.ok(rule)
  assert.equal(rule.permanent, true)
  assert.equal(rule.destination, 'https://www.pooldaybr.com/:path')
  // Webhooks e retornos antigos do Mercado Pago em /api continuam respondendo sem redirecionar.
  assert.ok(rule.source.includes('(?!api/)'))
  assert.equal(vercel.redirects.length, 1)
})
