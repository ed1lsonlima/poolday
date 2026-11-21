// Contagem própria de visitas: sem IP, sem nome e sem e-mail. O banco guarda só um número aleatório
// do navegador, a página, de onde a pessoa veio, o tipo de aparelho e a cidade aproximada.
const VISITOR_KEY = 'pd_visitor'
const SESSION_KEY = 'pd_session'
const SESSION_IDLE_MS = 30 * 60 * 1000

const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : null)

export function deviceType(userAgent = '') {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(userAgent)) return 'tablet'
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)) return 'celular'
  return 'computador'
}

export function isBot(userAgent = '', webdriver = false) {
  return webdriver || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse/i.test(userAgent)
}

export function referrerHost(referrer, ownHost) {
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    return host && host !== ownHost.replace(/^www\./, '') ? host : null
  } catch { return null }
}

export function campaignFrom(search = '') {
  const params = new URLSearchParams(search)
  const pick = key => params.get(key)?.trim().slice(0, 100) || null
  return { utm_source: pick('utm_source'), utm_medium: pick('utm_medium'), utm_campaign: pick('utm_campaign') }
}

// A Vercel informa a cidade aproximada no cookie pd_geo (middleware.js). Ex.: "Macei%C3%B3|AL|BR".
export function geoFromCookie(cookie = '') {
  const match = cookie.match(/(?:^|;\s*)pd_geo=([^;]*)/)
  if (!match) return { city: null, region: null }
  const [city, region, country] = decodeURIComponent(match[1]).split('|').map(value => { try { return decodeURIComponent(value) } catch { return value } })
  if (country && country !== 'BR') return { city: city ? `${city} (${country})` : country, region: null }
  return { city: city || null, region: region || null }
}

function readJSON(storage, key) {
  try { return JSON.parse(storage.getItem(key) || 'null') } catch { return null }
}

// A sessão termina depois de 30 minutos sem abrir páginas. A origem e a campanha ficam com a primeira página.
export function currentSession({ storage, now, search, referrer, ownHost }) {
  const saved = readJSON(storage, SESSION_KEY)
  if (saved?.id && now - saved.lastAt < SESSION_IDLE_MS) {
    const next = { ...saved, lastAt: now }
    try { storage.setItem(SESSION_KEY, JSON.stringify(next)) } catch { /* armazenamento bloqueado */ }
    return next
  }
  const next = { id: uuid(), lastAt: now, referrer_host: referrerHost(referrer, ownHost), ...campaignFrom(search) }
  try { storage.setItem(SESSION_KEY, JSON.stringify(next)) } catch { /* armazenamento bloqueado */ }
  return next
}

export function visitorId(storage) {
  try {
    const saved = storage.getItem(VISITOR_KEY)
    if (saved) return saved
    const created = uuid()
    if (created) storage.setItem(VISITOR_KEY, created)
    return created
  } catch { return null }
}

// Evento do programa de indicação, contado como uma "página" especial no painel do dono.
export function trackEvent(nome) {
  try {
    if (import.meta.env?.DEV) return
    const visit = buildVisit({ path: `/_evento/${nome}`, storage: globalThis.localStorage })
    if (visit) import('./supabase').then(({ supabase }) => supabase.rpc('registrar_visita', { p_visit: visit })).then(() => {}, () => {})
  } catch { /* a contagem nunca atrapalha a página */ }
}

export function buildVisit({ path, storage, now = Date.now(), win = globalThis.window, doc = globalThis.document, nav = globalThis.navigator }) {
  const userAgent = nav?.userAgent || ''
  if (isBot(userAgent, nav?.webdriver) || nav?.doNotTrack === '1') return null
  const visitor = visitorId(storage)
  const session = currentSession({ storage, now, search: win?.location?.search || '', referrer: doc?.referrer || '', ownHost: win?.location?.hostname || '' })
  if (!visitor || !session.id) return null
  return {
    visitor_id: visitor, session_id: session.id, path,
    referrer_host: session.referrer_host, utm_source: session.utm_source, utm_medium: session.utm_medium, utm_campaign: session.utm_campaign,
    device: deviceType(userAgent), ...geoFromCookie(doc?.cookie || ''),
  }
}
