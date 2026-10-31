// Endereço público único do PoolDay. Usado no navegador (VITE_SITE_URL),
// nas funções da Vercel (SITE_URL) e no build (canonical, og, sitemap, robots).
export const DEFAULT_SITE_URL = 'https://www.pooldaybr.com'

// Endereços antigos que hoje só redirecionam para o domínio oficial.
export const LEGACY_HOSTS = ['poolday-self.vercel.app', 'pooldaybr.com']

export function normalizeSiteUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    if (url.protocol !== 'https:' || url.username || url.password || LEGACY_HOSTS.includes(url.hostname)) return DEFAULT_SITE_URL
    return url.origin
  } catch {
    return DEFAULT_SITE_URL
  }
}

// Login e recuperação de senha precisam voltar para o mesmo endereço em que a
// sessão será guardada. Produção (e endereços antigos) sempre voltam ao domínio
// oficial; localhost e previews da Vercel continuam no próprio endereço.
export function authRedirectOrigin(location, siteUrl = DEFAULT_SITE_URL) {
  const site = normalizeSiteUrl(siteUrl)
  const hostname = location?.hostname || ''
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
  const isPreview = hostname.endsWith('.vercel.app') && !LEGACY_HOSTS.includes(hostname)
  return (isLocal || isPreview) && location?.origin ? location.origin : site
}

export const SITE_PATHS = ['/', '/explorar', '/cadastro', '/seja-anfitriao', '/termos', '/privacidade', '/acordo-anfitriao', '/cancelamento']

export function sitemapXml(siteUrl) {
  const site = normalizeSiteUrl(siteUrl)
  const meta = { '/': ['daily', '1.0'], '/explorar': ['daily', '0.9'], '/cadastro': ['monthly', '0.5'], '/seja-anfitriao': ['monthly', '0.8'] }
  const urls = SITE_PATHS.map(path => {
    const [freq, priority] = meta[path] || ['yearly', '0.2']
    return `  <url><loc>${site}${path}</loc><changefreq>${freq}</changefreq><priority>${priority}</priority></url>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export function robotsTxt(siteUrl) {
  const site = normalizeSiteUrl(siteUrl)
  return ['User-agent: *', 'Allow: /', 'Disallow: /anfitriao', 'Disallow: /perfil', 'Disallow: /reservas', 'Disallow: /favoritos', 'Disallow: /admin', 'Disallow: /indique-e-ganhe', 'Disallow: /api/', '', `Sitemap: ${site}/sitemap.xml`, ''].join('\n')
}
