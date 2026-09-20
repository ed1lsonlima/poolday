import { createClient } from '@supabase/supabase-js'
import { requireUser } from './_lib/auth.js'
import { getValidHostToken, refundPayment } from './_lib/mercadopago.js'
import { calculateCancellation, roundMoney } from '../src/lib/bookingPolicy.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function responseFromPolicy(booking, policy, actorRole) {
  const platformRetained = roundMoney(policy.retainedAmount * Number(booking.fee_rate || 0))
  return {
    bookingId: booking.id,
    canCancel: policy.canCancel,
    reason: policy.reason,
    cancelledBy: actorRole,
    paidAmount: roundMoney(booking.paid_amount),
    refundAmount: policy.refundAmount,
    retainedAmount: policy.retainedAmount,
    platformRetained,
    hostRetained: roundMoney(policy.retainedAmount - platformRetained),
    retentionRate: policy.retentionRate,
    freeCancellation: policy.freeCancellation,
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  try {
    const user = await requireUser(req, res, supabase)
    if (!user) return
    const { bookingId, action = 'preview', reason = '' } = req.body || {}
    if (typeof bookingId !== 'string' || !UUID.test(bookingId)) return res.status(400).json({ error: 'Reserva inválida.' })
    if (!['preview', 'confirm'].includes(action)) return res.status(400).json({ error: 'Ação inválida.' })
    if (action === 'confirm' && (typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 500)) {
      return res.status(400).json({ error: 'Informe brevemente o motivo do cancelamento.' })
    }

    const { data: booking, error } = await supabase.from('bookings').select(
      'id,host_id,client_id,status,total_amount,paid_amount,fee_rate,created_at,date,service_starts_at,payment_state,retained_amount,cancellation_rate,cancelled_by',
    ).eq('id', bookingId).single()
    if (error || !booking) return res.status(404).json({ error: 'Reserva não encontrada.' })

    const actorRole = user.id === booking.client_id ? 'client' : user.id === booking.host_id ? 'host' : null
    if (!actorRole) return res.status(403).json({ error: 'Você não pode cancelar esta reserva.' })
    const serviceStartsAt = booking.service_starts_at || `${booking.date}T08:00:00-03:00`
    const policy = calculateCancellation({
      totalAmount: booking.total_amount,
      paidAmount: booking.paid_amount,
      createdAt: booking.created_at,
      serviceStartsAt,
      cancelledBy: actorRole,
    })
    if (action === 'preview') return res.status(policy.canCancel ? 200 : 409).json(responseFromPolicy(booking, policy, actorRole))
    if (!policy.canCancel) return res.status(409).json({ error: policy.reason })

    const { data: preparedRows, error: prepareError } = await supabase.rpc('prepare_booking_cancellation', {
      p_booking_id: booking.id, p_actor: user.id, p_reason: reason.trim(),
    })
    if (prepareError) {
      if ((prepareError.message || '').includes('DIARIA_INICIADA')) return res.status(409).json({ error: 'A diária já começou. Fale com o suporte PoolDay.' })
      throw prepareError
    }
    const prepared = Array.isArray(preparedRows) ? preparedRows[0] : preparedRows
    const refundTotal = roundMoney(prepared?.refund_amount || 0)
    if (refundTotal <= 0) {
      return res.status(200).json({ success: true, refundAmount: 0, retainedAmount: roundMoney(prepared?.retained_amount || 0), status: 'cancelled' })
    }

    const { data: credentials, error: credentialsError } = await supabase.from('mp_credentials')
      .select('host_id,mp_access_token,mp_refresh_token,mp_token_expires_at').eq('host_id', booking.host_id).single()
    if (credentialsError || !credentials?.mp_access_token) throw new Error('MP_CREDENTIALS_UNAVAILABLE')
    const accessToken = await getValidHostToken(supabase, credentials)

    const { data: payments, error: paymentsError } = await supabase.from('payment_ledger')
      .select('payment_id,amount,refunded_amount,payment_stage,payment_created_at')
      .eq('booking_id', booking.id).eq('status', 'approved').order('payment_created_at', { ascending: false })
    if (paymentsError) throw paymentsError

    let remaining = refundTotal
    for (const payment of payments || []) {
      if (remaining <= 0.009) break
      const available = Math.max(0, roundMoney(Number(payment.amount) - Number(payment.refunded_amount || 0)))
      const amount = Math.min(remaining, available)
      if (amount <= 0) continue
      await refundPayment(accessToken, payment.payment_id, amount, payment.amount)
      remaining = roundMoney(remaining - amount)
    }
    if (remaining > 0.009) throw new Error('REFUND_PAYMENTS_NOT_FOUND')

    const { error: finalizeError } = await supabase.rpc('finalize_booking_cancellation', { p_booking_id: booking.id, p_refunded: refundTotal })
    if (finalizeError) throw finalizeError
    return res.status(200).json({ success: true, refundAmount: refundTotal, retainedAmount: roundMoney(prepared.retained_amount), status: 'cancelled' })
  } catch (error) {
    console.error('Erro ao cancelar reserva:', error.code || error.message)
    const bookingId = req.body?.bookingId
    if (typeof bookingId === 'string' && UUID.test(bookingId)) {
      try {
        await supabase.from('admin_events').upsert({
          event_key: `refund-failed:${bookingId}`, kind: 'refund', severity: 'urgent', title: 'Reembolso requer atenção',
          detail: 'O cancelamento foi solicitado, mas o Mercado Pago não concluiu todo o reembolso.', entity_id: bookingId,
        }, { onConflict: 'event_key', ignoreDuplicates: true })
      } catch { /* o erro original continua sendo a resposta principal */ }
    }
    return res.status(502).json({ error: 'Não foi possível concluir o reembolso automaticamente. A reserva ficou em análise e a equipe PoolDay foi avisada.' })
  }
}
