import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { normalizeSiteUrl, robotsTxt, sitemapXml } from './src/lib/siteUrl.js'

// Um único endereço público (VITE_SITE_URL, padrão https://www.pooldaybr.com)
// para canonical, og, sitemap e robots.
function siteUrlPlugin(siteUrl) {
  return {
    name: 'poolday-site-url',
    transformIndexHtml: html => html.replaceAll('__SITE_URL__', siteUrl),
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(siteUrl) })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(siteUrl) })
    },
    // /indique ganha título e prévia próprios no WhatsApp, que não executa o JavaScript do site.
    writeBundle(options) {
      const index = join(options.dir, 'index.html')
      if (existsSync(index)) writeFileSync(join(options.dir, 'indique.html'), indiqueHtml(readFileSync(index, 'utf8'), siteUrl))
    },
  }
}

const INDIQUE_TITULO = 'Indique um anfitrião: R$ 30 quando o espaço for aprovado — PoolDay'
const INDIQUE_DESCRICAO = 'Conhece alguém que aluga piscina ou chácara? Indique e ganhe R$ 30 no Pix quando o espaço dele for cadastrado completo e aprovado no PoolDay.'

export function indiqueHtml(html, siteUrl) {
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${INDIQUE_TITULO}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${INDIQUE_DESCRICAO}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${INDIQUE_TITULO}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${INDIQUE_DESCRICAO}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${INDIQUE_TITULO}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${siteUrl}/indique$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${siteUrl}/indique$2`)
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const siteUrl = normalizeSiteUrl(env.VITE_SITE_URL)
  return {
    plugins: [react(), siteUrlPlugin(siteUrl)],
    define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(siteUrl) },
  }
})
