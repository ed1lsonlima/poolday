import { LEGACY_HOSTS } from '../../src/lib/siteUrl.js';

// Endereços antigos (poolday-self.vercel.app e a raiz sem www) apenas
// redirecionam para o domínio oficial; nunca são destino de retorno.
const LEGACY_ORIGINS = new Set(LEGACY_HOSTS.map(host => `https://${host}`));

export function resolvePaymentReturnOrigin(req, siteUrl) {
  const fallback = new URL(siteUrl).origin;

  function accepted(value) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
      return url.origin === fallback && !LEGACY_ORIGINS.has(url.origin) ? url.origin : null;
    } catch {
      return null;
    }
  }

  // The buyer must return to the exact origin that holds their login session.
  return accepted(req.headers?.origin) || accepted(req.headers?.host && `https://${req.headers.host}`) || fallback;
}
