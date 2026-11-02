import { authRedirectOrigin, normalizeSiteUrl } from './siteUrl'

export const SITE_URL = normalizeSiteUrl(import.meta.env.VITE_SITE_URL)

// Endereço para onde o Supabase deve devolver quem entra com Google ou redefine a senha.
export const authRedirectUrl = (path = '') => `${authRedirectOrigin(window.location, SITE_URL)}${path}`
