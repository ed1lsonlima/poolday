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
    if (booking.status === 'confirmed') return res.status(200).json({ success: true, already: true });

    const { data: creds } = await supabase
      .from('mp_credentials')
      .select('mp_access_token')
      .eq('host_id', booking.host_id)
      .single();

    // O pagamento foi criado com o token do ANFITRIÃO, então a consulta
    // precisa usar o token dele (o da plataforma retornaria 404).
    const token = creds?.mp_access_token || process.env.MP_ACCESS_TOKEN;
    if (!token) return res.status(200).json({ success: true, ignored: true });

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!mpRes.ok) {
      console.error('Falha ao consultar pagamento no MP:', mpRes.status);
      return res.status(200).json({ success: true, ignored: true });
    }
    const payment = await mpRes.json();

    // 2. Validações de integridade: o pagamento é MESMO desta reserva e do valor cheio?
    if (payment.external_reference !== booking.id) {
      console.error('external_reference não bate com a reserva', paymentId, bookingId);
      return res.status(200).json({ success: true, ignored: true });
    }

    if (payment.status === 'approved') {
      const paid = Number(payment.transaction_amount || 0);
      if (paid + 0.01 < Number(booking.total_amount)) {
        console.error('Valor pago menor que o total da reserva', paid, booking.total_amount);
        return res.status(200).json({ success: true, ignored: true });
      }
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'confirmed', payment_id: String(paymentId) })
        .eq('id', booking.id)
        .eq('status', 'pending');
      if (error) throw error;
    } else if (['cancelled', 'rejected', 'refunded', 'charged_back'].includes(payment.status)) {
      await supabase
        .from('bookings')
        .update({ status: 'cancelled', payment_id: String(paymentId) })
        .eq('id', booking.id)
        .eq('status', 'pending');
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({ error: 'Erro ao processar webhook' });
  }
}
