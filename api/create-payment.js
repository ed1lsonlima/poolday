import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

// Se o token do anfitrião estiver perto de vencer (ou vencido), renova via refresh_token.
async function getValidHostToken(hostProfile) {
  const { mp_access_token, mp_refresh_token, mp_token_expires_at, id } = hostProfile;

  const expiresAt = mp_token_expires_at ? new Date(mp_token_expires_at).getTime() : 0;
  const isExpiringSoon = expiresAt - Date.now() < 24 * 60 * 60 * 1000; // menos de 1 dia

  if (!isExpiringSoon) return mp_access_token;

  const refreshRes = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: mp_refresh_token,
    }),
  });
  const refreshData = await refreshRes.json();

  if (!refreshRes.ok || !refreshData.access_token) {
    console.error('Falha ao renovar token MP do host:', refreshData);
    return mp_access_token; // tenta com o token antigo mesmo assim
  }

  const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 15552000) * 1000).toISOString();
  await supabase.from('profiles').update({
    mp_access_token: refreshData.access_token,
    mp_refresh_token: refreshData.refresh_token,
    mp_token_expires_at: newExpiresAt,
  }).eq('id', id);

  return refreshData.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  try {
    const { bookingId, amount, title, email } = req.body;

    // Busca a reserva pra saber quem é o anfitrião e qual a taxa da plataforma
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, host_id, platform_fee, host_amount, total_amount')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    const { data: hostProfile, error: hostError } = await supabase
      .from('profiles')
      .select('id, mp_access_token, mp_refresh_token, mp_token_expires_at')
      .eq('id', booking.host_id)
      .single();

    if (hostError || !hostProfile) {
      return res.status(404).json({ error: 'Anfitrião não encontrado' });
    }

    if (!hostProfile.mp_access_token) {
      // Anfitrião ainda não conectou a conta Mercado Pago - não dá pra fazer o split
      return res.status(400).json({
        error: 'host_sem_mp',
        message: 'Este anfitrião ainda não conectou sua conta do Mercado Pago. Não é possível processar o pagamento.',
      });
    }

    const hostAccessToken = await getValidHostToken(hostProfile);

    // Cria a preferência USANDO O TOKEN DO ANFITRIÃO - o dinheiro cai direto na conta dele,
    // com a taxa da plataforma (marketplace_fee) sendo debitada automaticamente pelo Mercado Pago.
    const client = new MercadoPagoConfig({ accessToken: hostAccessToken });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: bookingId,
            title: title,
            quantity: 1,
            unit_price: Math.round(Number(amount) * 100) / 100,
          },
        ],
        payer: { email },
        back_urls: {
          success: 'https://poolday-self.vercel.app/reservas',
          failure: 'https://poolday-self.vercel.app/explorar',
          pending: 'https://poolday-self.vercel.app/reservas',
        },
        external_reference: bookingId,
        notification_url: 'https://poolday-self.vercel.app/api/webhook',
        auto_return: 'approved',
        marketplace_fee: Math.round(Number(booking.platform_fee) * 100) / 100,
      },
    });

    res.status(200).json({ init_point: result.init_point });
  } catch (error) {
    console.error('Erro ao criar preferencia:', error);
    res.status(500).json({ error: 'Erro ao processar pagamento' });
  }
}
