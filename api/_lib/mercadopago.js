export async function getValidHostToken(supabase, credentials) {
  const expiresAt = credentials.mp_token_expires_at ? new Date(credentials.mp_token_expires_at).getTime() : 0
  const isExpiringSoon = expiresAt - Date.now() < 24 * 60 * 60 * 1000
  if (!isExpiringSoon) return credentials.mp_access_token

  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: credentials.mp_refresh_token,
    }),
  })
  const data = await response.json()
  if (!response.ok || !data.access_token) throw new Error('MP_TOKEN_REFRESH_FAILED')

  const expiresAtIso = new Date(Date.now() + (data.expires_in || 15552000) * 1000).toISOString()
  const { error } = await supabase.from('mp_credentials').update({
    mp_access_token: data.access_token,
    mp_refresh_token: data.refresh_token || credentials.mp_refresh_token,
    mp_token_expires_at: expiresAtIso,
    updated_at: new Date().toISOString(),
  }).eq('host_id', credentials.host_id)
  if (error) throw error
  return data.access_token
}

export async function refundPayment(accessToken, paymentId, amount, fullAmount) {
  const isFullRefund = Math.abs(Number(amount) - Number(fullAmount)) < 0.01
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `poolday-refund-${paymentId}-${Number(amount).toFixed(2)}`,
    },
    body: JSON.stringify(isFullRefund ? {} : { amount: Number(amount) }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data?.message || 'Não foi possível processar o reembolso no Mercado Pago.')
    error.status = response.status
    error.provider = data
    throw error
  }
  return data
}

