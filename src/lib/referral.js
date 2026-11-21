// Código de indicação vindo de ?ref=CODIGO (ou do link antigo /i/:codigo). Fica guardado por 60 dias
// (localStorage + cookie) até o anfitrião criar a conta. Vale o primeiro código: outro link depois não troca.
export const REFERRAL_DAYS = 60
const KEY = 'poolday_ref'
const COOKIE = 'pd_ref'

export function normalizeReferralCode(value) {
  const code = String(value || '').trim().toUpperCase()
  return /^[A-Z0-9]{6,12}$/.test(code) ? code : null
}

function readSaved(storage, now) {
  try {
    const saved = JSON.parse(storage?.getItem(KEY) || 'null')
    if (saved && saved.expiresAt > now && normalizeReferralCode(saved.code)) return { code: normalizeReferralCode(saved.code), clickedAt: saved.clickedAt || null }
  } catch { /* valor corrompido ou armazenamento bloqueado */ }
  return null
}

export function readReferralCode({ storage = globalThis.localStorage, doc = globalThis.document, now = Date.now() } = {}) {
  const saved = readSaved(storage, now)
  if (saved) return saved.code
  try {
    const match = (doc?.cookie || '').match(/(?:^|;\s*)pd_ref=([^;]+)/)
    return normalizeReferralCode(match?.[1])
  } catch {
    return null
  }
}

export function saveReferralCode(value, { storage = globalThis.localStorage, doc = globalThis.document, now = Date.now() } = {}) {
  const code = normalizeReferralCode(value)
  if (!code) return null
  const existing = readReferralCode({ storage, doc, now })
  if (existing) return existing
  const expiresAt = now + REFERRAL_DAYS * 24 * 60 * 60 * 1000
  try { storage?.setItem(KEY, JSON.stringify({ code, expiresAt, clickedAt: new Date(now).toISOString() })) } catch { /* navegador sem armazenamento */ }
  try { if (doc) doc.cookie = `${COOKIE}=${code}; Max-Age=${REFERRAL_DAYS * 24 * 60 * 60}; Path=/; SameSite=Lax; Secure` } catch { /* cookies bloqueados */ }
  return code
}

export function readReferralClickedAt({ storage = globalThis.localStorage, now = Date.now() } = {}) {
  return readSaved(storage, now)?.clickedAt || null
}

export function clearReferralCode({ storage = globalThis.localStorage, doc = globalThis.document } = {}) {
  try { storage?.removeItem(KEY) } catch { /* ignore */ }
  try { if (doc) doc.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax; Secure` } catch { /* ignore */ }
}

// Situações devolvidas por registrar_indicacao que encerram a tentativa (não adianta repetir).
export const FINAL_REFERRAL_RESULTS = new Set(['REGISTRADA', 'JA_REGISTRADA', 'CONTA_ANTIGA', 'AUTOINDICACAO', 'CODIGO_INVALIDO', 'PROGRAMA_DESLIGADO'])

export const referralLink = (siteUrl, code) => `${siteUrl}/seja-anfitriao?ref=${code}`
