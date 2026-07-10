import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Metodo nao permitido' });
    }

  try {
        const { data } = req.body;

      if (!data || data.type !== 'payment') {
              return res.status(200).json({ success: true });
      }

      const paymentId = data.id;

      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
              headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
        const payment = await mpRes.json();

      if (payment.status !== 'approved') {
              return res.status(200).json({ success: true });
      }

      const bookingId = payment.external_reference;

      const { error: updateError } = await supabase
          .from('bookings')
          .update({ status: 'confirmed', payment_id: String(paymentId) })
          .eq('id', bookingId);

      if (updateError) throw updateError;

      res.status(200).json({ success: true, booking_id: bookingId });
  } catch (error) {
        console.error('Erro ao processar webhook:', error);
        res.status(500).json({ error: 'Erro ao processar webhook' });
  }
}
