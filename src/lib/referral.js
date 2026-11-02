// Código de indicação vindo de /i/:codigo. Fica guardado por 30 dias
// (localStorage + cookie) até o anfitrião criar a conta.
export const REFERRAL_DAYS = 30
export const REFERRAL_VALUE_CENTS = 2000
const KEY = 'poolday_ref'
const COOKIE = 'pd_ref'

export function normalizeReferralCode(value) {
  const code = String(value || '').trim().toLowerCase()
  return /^[a-z0-9]{6,12}$/.test(code) ? code : null
}

export function saveReferralCode(value, { storage = globalThis.localStorage, doc = globalThis.document, now = Date.now() } = {}) {
  const code = normalizeReferralCode(value)
  if (!code) return null
  const expiresAt = now + REFERRAL_DAYS * 24 * 60 * 60 * 1000
  try { storage?.setItem(KEY, JSON.stringify({ code, expiresAt })) } catch { /* navegador sem armazenamento */ }
  try { if (doc) doc.cookie = `${COOKIE}=${code}; Max-Age=${REFERRAL_DAYS * 24 * 60 * 60}; Path=/; SameSite=Lax; Secure` } catch { /* cookies bloqueados */ }
  return code
}

export function readReferralCode({ storage = globalThis.localStorage, doc = globalThis.document, now = Date.now() } = {}) {
  try {
    const saved = JSON.parse(storage?.getItem(KEY) || 'null')
    if (saved && saved.expiresAt > now && normalizeReferralCode(saved.code)) return saved.code
  } catch { /* valor corrompido ou armazenamento bloqueado */ }
  try {
    const match = (doc?.cookie || '').match(/(?:^|;\s*)pd_ref=([^;]+)/)
    return normalizeReferralCode(match?.[1])
  } catch {
    return null
  }
}

export function clearReferralCode({ storage = globalThis.localStorage, doc = globalThis.document } = {}) {
  try { storage?.removeItem(KEY) } catch { /* ignore */ }
  try { if (doc) doc.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax; Secure` } catch { /* ignore */ }
}

// Situações devolvidas por registrar_indicacao que encerram a tentativa (não adianta repetir).
export const FINAL_REFERRAL_RESULTS = new Set(['REGISTRADA', 'JA_REGISTRADA', 'CONTA_ANTIGA', 'AUTOINDICACAO', 'CODIGO_INVALIDO'])

export const REFERRAL_STATUS = {
  cadastrou: 'Criou a conta',
  aguardando_aprovacao: 'Espaço em análise',
  a_pagar: 'Aprovada, a pagar',
  paga: 'Paga',
  recusada: 'Recusada',
}

export const referralLink = (siteUrl, code) => `${siteUrl}/i/${code}`
