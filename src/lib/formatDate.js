// Helpers de data do PoolDay.
// A coluna `date` do Supabase volta como string 'YYYY-MM-DD'.
// Usar new Date('YYYY-MM-DD') interpreta como meia-noite UTC e, no fuso do
// Brasil (UTC-3), volta pro dia anterior. Estas funcoes evitam esse deslocamento.

// 'YYYY-MM-DD' (ou ISO com hora) -> 'DD/MM/YYYY'
export function formatDateBR(dateStr) {
  if (!dateStr) return ''
  const s = String(dateStr).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return String(dateStr)
  return `${d}/${m}/${y}`
}

// 'YYYY-MM-DD' -> objeto Date na meia-noite LOCAL (sem pulo de fuso).
// Util pra comparacoes/calendario, quando precisar de um Date de verdade.
export function parseLocalDate(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
