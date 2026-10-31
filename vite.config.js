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
  }
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
