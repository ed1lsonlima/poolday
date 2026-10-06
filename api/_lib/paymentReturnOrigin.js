const PUBLIC_ORIGINS = [
  'https://www.pooldaybr.com',
  'https://pooldaybr.com',
  'https://poolday-self.vercel.app',
];

export function resolvePaymentReturnOrigin(req, siteUrl) {
  const fallback = new URL(siteUrl).origin;
  const allowed = new Set([...PUBLIC_ORIGINS, fallback]);

  function accepted(value) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
      return allowed.has(url.origin) ? url.origin : null;
    } catch {
      return null;
    }
  }

  // The buyer must return to the exact origin that holds their login session.
  return accepted(req.headers?.origin) || accepted(req.headers?.host && `https://${req.headers.host}`) || fallback;
}

