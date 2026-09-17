import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Valida a assinatura x-signature do Mercado Pago (se MP_WEBHOOK_SECRET estiver configurado).
function isValidSignature(req, paymentId) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // sem secret configurado, seguimos com a validação via consulta à API
  try {
    const signature = req.headers['x-signature'] || '';
    const requestId = req.headers['x-request-id'] || '';
    const parts = Object.fromEntries(signature.split(',').map(p => p.trim().split('=')));
    if (!parts.ts || !parts.v1) return false;
    const manifest = `id:${String(paymentId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
    const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(parts.v1));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // O MP manda o id do pagamento no corpo (data.id) ou na query (?data.id=...).
    const paymentId = req.body?.data?.id || req.query['data.id'] || req.query.id;
    const topic = req.body?.type || req.query.type || req.query.topic;
    const bookingId = req.query.booking;

    if (!paymentId || (topic && topic !== 'payment')) {
      return res.status(200).json({ success: true, ignored: true });
    }
    if (!bookingId) {
      // Notificação antiga sem ?booking= — não temos como saber o token certo. Ignora com 200.
      return res.status(200).json({ success: true, ignored: true });
    }
    if (!isValidSignature(req, paymentId)) {
      return res.status(401).json({ error: 'Assinatura inválida' });
    }

    // 1. Busca a reserva pra descobrir o anfitrião (e o token dele).
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, host_id, status, total_amount')
      .eq('id', bookingId)
      .single();

    if (!booking) return res.status(200).json({ success: true, ignored: true });

    const { data: creds } = await supabase
      .from('mp_credentials')
      .select('mp_access_token')
      .eq('host_id', booking.host_id)
      .single();

    // O pagamento foi criado com o token do ANFITRIÃO, então a consulta
    // precisa usar o token dele (o da plataforma retornaria 404).
    const token = creds?.mp_access_token || process.env.MP_ACCESS_TOKEN;
    if (!token) return res.status(503).json({ error: 'Credenciais indisponíveis' });

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!mpRes.ok) {
      console.error('Falha ao consultar pagamento no MP:', mpRes.status);
      return res.status(503).json({ error: 'Consulta indisponível' });
    }
    const payment = await mpRes.json();

    // 2. Validações de integridade: o pagamento é MESMO desta reserva e do valor cheio?
    if (payment.external_reference !== booking.id) {
      console.error('external_reference não bate com a reserva', paymentId, bookingId);
      return res.status(200).json({ success: true, ignored: true });
    }

    const paid = Number(payment.transaction_amount || 0);
    if (Math.abs(paid - Number(booking.total_amount)) > 0.01 || payment.currency_id !== 'BRL') return res.status(400).json({ error: 'Valor ou moeda divergente' });
    const fees = payment.fee_details || [];
    const refunded = Number(payment.transaction_amount_refunded || 0);
    const terminal = ['refunded', 'charged_back'].includes(payment.status);
    const { error: ledgerError } = await supabase.rpc('record_payment', { p_payment: {
      payment_id: String(paymentId), booking_id: booking.id, status: payment.status,
      amount: paid, refunded_amount: refunded,
      platform_fee: terminal ? 0 : fees.filter(f => f.type === 'application_fee').reduce((sum, f) => sum + Number(f.amount || 0), 0),
      provider_fee: fees.filter(f => f.type !== 'application_fee').reduce((sum, f) => sum + Number(f.amount || 0), 0),
      host_net: terminal ? 0 : payment.transaction_details?.net_received_amount ?? null,
      payment_created_at: payment.date_created,
      provider_updated_at: payment.date_last_updated || payment.date_created,
    } });
    if (ledgerError) throw ledgerError;

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({ error: 'Erro ao processar webhook' });
  }
}
