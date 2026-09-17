import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = process.env.SITE_URL || 'https://www.pooldaybr.com';
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function bearerToken(req) {
  const value = req.headers.authorization || '';
  return typeof value === 'string' ? /^Bearer ([^\s]+)$/i.exec(value)?.[1] : null;
}

// Renova o token do anfitrião via refresh_token se estiver perto de vencer.
async function getValidHostToken(creds) {
  const expiresAt = creds.mp_token_expires_at ? new Date(creds.mp_token_expires_at).getTime() : 0;
  const isExpiringSoon = expiresAt - Date.now() < 24 * 60 * 60 * 1000;
  if (!isExpiringSoon) return creds.mp_access_token;

  const refreshRes = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
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
    console.error('Falha ao renovar token MP do host:', refreshRes.status);
    return creds.mp_access_token;
  }

  const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 15552000) * 1000).toISOString();
  const { error: refreshSaveError } = await supabase.from('mp_credentials').update({
    mp_access_token: refreshData.access_token,
    mp_refresh_token: refreshData.refresh_token || creds.mp_refresh_token,
    mp_token_expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  }).eq('host_id', creds.host_id);
  if (refreshSaveError) throw refreshSaveError;

  return refreshData.access_token;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: 'Faça login para pagar.' });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) return res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' });

    const { bookingId } = req.body || {};
    if (typeof bookingId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) return res.status(400).json({ error: 'bookingId válido é obrigatório' });

    // 1. Busca a reserva. NUNCA confia em valores vindos do navegador.
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, host_id, client_id, property_id, status, date')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }
    if (booking.client_id !== authData.user.id) {
      return res.status(403).json({ error: 'Você não pode pagar esta reserva.' });
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'Esta reserva não está mais aguardando pagamento.' });
    }
    const { data: participants, error: participantError } = await supabase.from('profiles').select('suspended').in('id', [booking.host_id, booking.client_id]);
    if (participantError) throw participantError;
    if (!participants || participants.length !== new Set([booking.host_id, booking.client_id]).size || participants.some(profile => profile.suspended)) return res.status(403).json({ error: 'Esta reserva requer atendimento do suporte.' });

    // 2. Recalcula o valor NO SERVIDOR a partir do preço real do espaço.
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id, name, host_id, is_active, moderation_status')
      .eq('id', booking.property_id)
      .single();

    if (propError || !property || !property.is_active || property.moderation_status !== 'approved' || property.host_id !== booking.host_id) {
      return res.status(400).json({ error: 'Espaço indisponível.' });
    }

    // Calcula valores e reivindica, de forma transacional, uma das 3 reservas
    // promocionais do anfitrião. Repetir a chamada devolve a mesma promoção.
    const { data: paymentRows, error: prepareError } = await supabase.rpc('prepare_booking_payment', { p_booking_id: bookingId });
    if (prepareError) {
      if ((prepareError.message || '').includes('RESERVA_INDISPONIVEL')) {
        return res.status(409).json({ error: 'Reserva expirada ou indisponível.' });
      }
      if ((prepareError.message || '').includes('ESPACO_INDISPONIVEL')) return res.status(409).json({ error: 'Espaço indisponível.' });
      throw prepareError;
    }
    const paymentData = Array.isArray(paymentRows) ? paymentRows[0] : paymentRows;
    if (!paymentData) throw new Error('EMPTY_PAYMENT');
    const totalAmount = Number(paymentData.total_amount);
    const platformFee = Number(paymentData.platform_fee);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isFinite(platformFee) || platformFee < 0 || platformFee > totalAmount) throw new Error('INVALID_AMOUNT');

    if (paymentData.payment_init_point && new Date(paymentData.payment_expires_at).getTime() > Date.now()) {
      return res.status(200).json({ init_point: paymentData.payment_init_point, promotion_applied: paymentData.promotion_applied });
    }

    // 3. Credenciais do anfitrião (tabela privada, só o servidor lê).
    const { data: creds, error: credentialsError } = await supabase
      .from('mp_credentials')
      .select('host_id, mp_access_token, mp_refresh_token, mp_token_expires_at')
      .eq('host_id', booking.host_id)
      .maybeSingle();
    if (credentialsError) throw credentialsError;

    if (!creds?.mp_access_token) {
      return res.status(400).json({
        error: 'host_sem_mp',
        message: 'Este anfitrião ainda não conectou a conta do Mercado Pago.',
      });
    }

    const hostAccessToken = await getValidHostToken(creds);

    // 5. Cria a preferência com o token do ANFITRIÃO: o dinheiro cai na conta dele
    //    e o marketplace_fee (15%) é retido automaticamente pela plataforma.
    const client = new MercadoPagoConfig({ accessToken: hostAccessToken });
    const preference = new Preference(client);

    const result = await preference.create({
      requestOptions: { idempotencyKey: `poolday-booking-${booking.id}`, timeout: 15000 },
      body: {
        items: [{
          id: booking.id,
          title: `PoolDay — ${property.name} (${booking.date})`,
          quantity: 1,
          unit_price: totalAmount,
          currency_id: 'BRL',
        }],
        payer: authData.user.email ? { email: authData.user.email } : undefined,
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
        marketplace_fee: platformFee > 0 ? platformFee : undefined,
        expires: true,
        expiration_date_to: new Date(paymentData.hold_expires_at).toISOString(),
      },
    });
    if (!result.id || typeof result.init_point !== 'string' || !result.init_point.startsWith('https://')) throw new Error('INVALID_PREFERENCE');

    const { data: saved, error: savePreferenceError } = await supabase.from('bookings').update({
      payment_preference_id: String(result.id),
      payment_init_point: result.init_point,
      payment_expires_at: paymentData.hold_expires_at,
    }).eq('id', bookingId).eq('status', 'pending').is('payment_preference_id', null).select('id').maybeSingle();
    if (savePreferenceError) throw savePreferenceError;
    if (!saved) {
      const { data: current, error: currentError } = await supabase.from('bookings').select('status,payment_init_point,payment_expires_at').eq('id', bookingId).single();
      if (currentError) throw currentError;
      if (current.status !== 'pending' || !current.payment_init_point || Date.parse(current.payment_expires_at) <= Date.now()) return res.status(409).json({ error: 'Reserva expirada ou indisponível.' });
      return res.status(200).json({ init_point: current.payment_init_point, promotion_applied: paymentData.promotion_applied });
    }

    res.status(200).json({ init_point: result.init_point, promotion_applied: paymentData.promotion_applied });
  } catch (error) {
    console.error('Erro ao criar preferência:', error.code || error.message);
    res.status(500).json({ error: 'Erro ao processar pagamento' });
  }
}
