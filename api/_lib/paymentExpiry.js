// The installment RPC returns the deadline for the requested stage under this
// name, for both the first payment and the balance. Do not reuse the first hold.
export function paymentExpiration(paymentData) {
  const value = paymentData?.payment_expires_at
  const timestamp = typeof value === 'string' && value.trim() ? Date.parse(value) : NaN
  if (!Number.isFinite(timestamp)) throw new Error('INVALID_PAYMENT_EXPIRATION')
  return new Date(timestamp).toISOString()
}
