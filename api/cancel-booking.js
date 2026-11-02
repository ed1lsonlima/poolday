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

// Devolve os pagamentos do mais recente ao mais antigo. Em falha, o erro informa quanto já voltou.
async function refundApprovedPayments(accessToken, bookingId, total) {
  const { data: payments, error } = await supabase.from('payment_ledger')
    .select('payment_id,amount,refunded_amount,payment_stage,payment_created_at')
    .eq('booking_id', bookingId).eq('status', 'approved').order('payment_created_at', { ascending: false })
  if (error) throw error
  let remaining = total
  try {
    for (const payment of payments || []) {
      if (remaining <= 0.009) break
      const available = Math.max(0, roundMoney(Number(payment.amount) - Number(payment.refunded_amount || 0)))
      const amount = Math.min(remaining, available)
      if (amount <= 0) continue
      await refundPayment(accessToken, payment.payment_id, amount, payment.amount)
      remaining = roundMoney(remaining - amount)
    }
    if (remaining > 0.009) throw new Error('REFUND_PAYMENTS_NOT_FOUND')
  } catch (refundError) {
    refundError.refunded = roundMoney(total - remaining)
    throw refundError
  }
}

async function hostAccessToken(hostId) {
  const { data: credentials, error } = await supabase.from('mp_credentials')
    .select('host_id,mp_access_token,mp_refresh_token,mp_token_expires_at').eq('host_id', hostId).single()
  if (error || !credentials?.mp_access_token) throw new Error('MP_CREDENTIALS_UNAVAILABLE')
  return getValidHostToken(supabase, credentials)
}

// Recusa clara: o Mercado Pago respondeu que não, ou a conta dele não está acessível.
const isDefiniteRefusal = error => (error.status >= 400 && error.status < 500)
  || ['MP_CREDENTIALS_UNAVAILABLE', 'MP_TOKEN_REFRESH_FAILED'].includes(error.message)

// O anfitrião só cancela uma reserva paga se o dinheiro voltar para o cliente.
async function cancelPaidAsHost(res, booking, userId, reason) {
  const { data: rows, error: beginError } = await supabase.rpc('begin_host_cancellation', {
    p_booking_id: booking.id, p_actor: userId, p_reason: reason,
  })
  if (beginError) {
    if ((beginError.message || '').includes('DIARIA_INICIADA')) return res.status(409).json({ error: 'A diária já começou. Fale com o suporte PoolDay.' })
    throw beginError
  }
  const begun = Array.isArray(rows) ? rows[0] : rows
  const refundTotal = roundMoney(begun?.refund_amount || 0)
  try {
    await refundApprovedPayments(await hostAccessToken(booking.host_id), booking.id, refundTotal)
  } catch (refundError) {
    console.error('Reembolso do anfitrião falhou:', refundError.status || refundError.message)
    const canRestore = begun.previous_state && !refundError.refunded && isDefiniteRefusal(refundError)
    if (canRestore) {
      const { error: abortError } = await supabase.rpc('abort_host_cancellation', { p_booking_id: booking.id, p_previous_state: begun.previous_state })
      if (abortError) throw abortError
    }
    await supabase.from('admin_events').upsert({
      event_key: `host-refund-failed:${booking.id}`, kind: 'refund', severity: 'urgent', title: 'Anfitrião tentou cancelar, e o reembolso falhou',
      detail: canRestore ? 'A reserva continua ativa, e o cliente não foi avisado. Fale com o anfitrião.' : 'O reembolso ficou incompleto ou sem resposta. Confira no Mercado Pago.', entity_id: booking.id,
    }, { onConflict: 'event_key', ignoreDuplicates: true })
    return res.status(409).json({
      error: canRestore
        ? 'O Mercado Pago não aceitou o reembolso, então a reserva continua ativa. Confira se sua conta tem saldo suficiente e tente de novo. A equipe PoolDay foi avisada.'
        : 'O reembolso não foi concluído. A reserva ficou em análise, e a equipe PoolDay foi avisada.',
    })
  }
  const { error: finalizeError } = await supabase.rpc('finalize_booking_cancellation', { p_booking_id: booking.id, p_refunded: refundTotal })
  if (finalizeError) throw finalizeError
  const { error: afterError } = await supabase.rpc('after_host_cancellation', { p_booking_id: booking.id })
  if (afterError) throw afterError
  return res.status(200).json({ success: true, refundAmount: refundTotal, retainedAmount: 0, status: 'cancelled', propertyPaused: true })
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
    if (actorRole === 'host' && Number(booking.paid_amount) > 0) return await cancelPaidAsHost(res, booking, user.id, reason.trim())

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

    await refundApprovedPayments(await hostAccessToken(booking.host_id), booking.id, refundTotal)

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
