import { normalizeSiteUrl } from '../../src/lib/siteUrl.js'

// Endereço público único para retornos do Mercado Pago e links enviados.
// Na Vercel: variável SITE_URL (padrão https://www.pooldaybr.com).
export const SITE_URL = normalizeSiteUrl(process.env.SITE_URL)
