import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = process.env.SITE_URL || 'https://poolday-self.vercel.app';
const PLATFORM_FEE_RATE = 0.15;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Renova o token do anfitrião via refresh_token se estiver perto de vencer.
async function getValidHostToken(creds) {
  const expiresAt = creds.mp_token_expires_at ? new Date(creds.mp_token_expires_at).getTime() : 0;
  const isExpiringSoon = expiresAt - Date.now() < 24 * 60 * 60 * 1000;
  if (!isExpiringSoon) return creds.mp_access_token;

  const refreshRes = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: creds.mp_refresh_token,
    }),
  });
  const refreshData = await refreshRes.json();
  if (!refreshRes.ok || !refreshData.access_token) {
    console.error('Falha ao renovar token MP do host:', refreshData);
    return creds.mp_access_token;
  }

  const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 15552000) * 1000).toISOString();
  await supabase.from('mp_credentials').update({
    mp_access_token: refreshData.access_token,
    mp_refresh_token: refreshData.refresh_token,
    mp_token_expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  }).eq('host_id', creds.host_id);

  return refreshData.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { bookingId } = req.body || {};
    if (!bookingId) return res.status(400).json({ error: 'bookingId é obrigatório' });

    // 1. Busca a reserva. NUNCA confia em valores vindos do navegador.
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, host_id, client_id, property_id, status, date')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'Esta reserva não está mais aguardando pagamento.' });
    }

    // 2. Recalcula o valor NO SERVIDOR a partir do preço real do espaço.
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id, name, price_per_day, price_per_hour, is_active')
      .eq('id', booking.property_id)
      .single();

    if (propError || !property || !property.is_active) {
      return res.status(400).json({ error: 'Espaço indisponível.' });
    }

    const totalAmount = Math.round(Number(property.price_per_day || property.price_per_hour) * 100) / 100;
    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ error: 'Preço do espaço inválido.' });
    }
    const platformFee = Math.round(totalAmount * PLATFORM_FEE_RATE * 100) / 100;
    const hostAmount = Math.round((totalAmount - platformFee) * 100) / 100;

    // Grava os valores corretos na reserva (corrige qualquer valor adulterado no insert).
    await supabase.from('bookings').update({
      total_amount: totalAmount,
      platform_fee: platformFee,
      host_amount: hostAmount,
    }).eq('id', bookingId);

    // 3. Credenciais do anfitrião (tabela privada, só o servidor lê).
    const { data: creds } = await supabase
      .from('mp_credentials')
      .select('host_id, mp_access_token, mp_refresh_token, mp_token_expires_at')
      .eq('host_id', booking.host_id)
      .single();

    if (!creds?.mp_access_token) {
      return res.status(400).json({
        error: 'host_sem_mp',
        message: 'Este anfitrião ainda não conectou a conta do Mercado Pago.',
      });
    }

    const hostAccessToken = await getValidHostToken(creds);

    // 4. E-mail do pagador vem do banco, não do navegador.
    const { data: clientProfile } = await supabase
      .from('profiles').select('email').eq('id', booking.client_id).single();

    // 5. Cria a preferência com o token do ANFITRIÃO: o dinheiro cai na conta dele
    //    e o marketplace_fee (15%) é retido automaticamente pela plataforma.
    const client = new MercadoPagoConfig({ accessToken: hostAccessToken });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [{
          id: booking.id,
          title: `PoolDay — ${property.name} (${booking.date})`,
          quantity: 1,
          unit_price: totalAmount,
        }],
        payer: clientProfile?.email ? { email: clientProfile.email } : undefined,
        back_urls: {
          success: `${SITE_URL}/reservas?pagamento=sucesso`,
          failure: `${SITE_URL}/espaco/${property.id}?pagamento=falhou`,
          pending: `${SITE_URL}/reservas?pagamento=pendente`,
        },
        external_reference: booking.id,
        // O booking vai na query string: é assim que o webhook descobre qual
        // token de anfitrião usar pra consultar o pagamento.
        notification_url: `${SITE_URL}/api/webhook?booking=${booking.id}`,
        auto_return: 'approved',
        statement_descriptor: 'POOLDAY',
        marketplace_fee: platformFee,
      },
    });

    res.status(200).json({ init_point: result.init_point });
  } catch (error) {
    console.error('Erro ao criar preferência:', error);
    res.status(500).json({ error: 'Erro ao processar pagamento' });
  }
}
