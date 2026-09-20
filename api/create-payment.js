import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from './_lib/auth.js';
import { getValidHostToken } from './_lib/mercadopago.js';

const SITE_URL = process.env.SITE_URL || 'https://www.pooldaybr.com';
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const user = await requireUser(req, res, supabase);
    if (!user) return;

    const { bookingId, stage: requestedStage } = req.body || {};
    if (typeof bookingId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) return res.status(400).json({ error: 'bookingId válido é obrigatório' });

    // 1. Busca a reserva. NUNCA confia em valores vindos do navegador.
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, host_id, client_id, property_id, status, date, payment_plan, payment_state')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }
    if (booking.client_id !== user.id) {
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
    const stage = requestedStage || (booking.payment_plan === 'full' ? 'full' : booking.payment_state === 'awaiting_first_payment' ? 'deposit' : 'balance');
    const { data: paymentRows, error: prepareError } = await supabase.rpc('prepare_booking_installment', { p_booking_id: bookingId, p_stage: stage });
    if (prepareError) {
      if ((prepareError.message || '').includes('RESERVA_INDISPONIVEL')) {
        return res.status(409).json({ error: 'Reserva expirada ou indisponível.' });
      }
      if ((prepareError.message || '').includes('ESPACO_INDISPONIVEL')) return res.status(409).json({ error: 'Espaço indisponível.' });
      throw prepareError;
    }
    const paymentData = Array.isArray(paymentRows) ? paymentRows[0] : paymentRows;
    if (!paymentData) throw new Error('EMPTY_PAYMENT');
    const totalAmount = Number(paymentData.payment_amount);
    const platformFee = Number(paymentData.platform_fee);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isFinite(platformFee) || platformFee < 0 || platformFee > totalAmount) throw new Error('INVALID_AMOUNT');

    if (paymentData.payment_init_point && new Date(paymentData.payment_expires_at).getTime() > Date.now()) {
      return res.status(200).json({ init_point: paymentData.payment_init_point, promotion_applied: paymentData.promotion_applied, stage, amount: totalAmount });
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

    const hostAccessToken = await getValidHostToken(supabase, creds);

    // 5. Cria a preferência com o token do ANFITRIÃO: o dinheiro cai na conta dele
    //    e o marketplace_fee (15%) é retido automaticamente pela plataforma.
    const client = new MercadoPagoConfig({ accessToken: hostAccessToken });
    const preference = new Preference(client);

    const result = await preference.create({
      requestOptions: { idempotencyKey: `poolday-booking-${booking.id}-${stage}`, timeout: 15000 },
      body: {
        items: [{
          id: booking.id,
          title: `PoolDay — ${stage === 'deposit' ? 'entrada' : stage === 'balance' ? 'saldo' : 'reserva'} — ${property.name} (${booking.date})`,
          quantity: 1,
          unit_price: totalAmount,
          currency_id: 'BRL',
        }],
        payer: user.email ? { email: user.email } : undefined,
        back_urls: {
          success: `${SITE_URL}/reservas?pagamento=sucesso&etapa=${stage}`,
          failure: `${SITE_URL}/espaco/${property.id}?pagamento=falhou`,
          pending: `${SITE_URL}/reservas?pagamento=pendente&etapa=${stage}`,
        },
        external_reference: booking.id,
        metadata: { booking_id: booking.id, payment_stage: stage },
        // O booking vai na query string: é assim que o webhook descobre qual
        // token de anfitrião usar pra consultar o pagamento.
        notification_url: `${SITE_URL}/api/webhook?booking=${booking.id}&stage=${stage}`,
        auto_return: 'approved',
        statement_descriptor: 'POOLDAY',
        marketplace_fee: platformFee > 0 ? platformFee : undefined,
        expires: true,
        expiration_date_to: new Date(paymentData.hold_expires_at).toISOString(),
      },
    });
    if (!result.id || typeof result.init_point !== 'string' || !result.init_point.startsWith('https://')) throw new Error('INVALID_PREFERENCE');

    const preferenceUpdate = stage === 'balance' ? {
      balance_payment_preference_id: String(result.id), balance_payment_init_point: result.init_point,
    } : {
      payment_preference_id: String(result.id), payment_init_point: result.init_point, payment_expires_at: paymentData.payment_expires_at,
    };
    let saveQuery = supabase.from('bookings').update(preferenceUpdate).eq('id', bookingId).eq('status', 'pending');
    saveQuery = stage === 'balance' ? saveQuery.is('balance_payment_preference_id', null) : saveQuery.is('payment_preference_id', null);
    const { data: saved, error: savePreferenceError } = await saveQuery.select('id').maybeSingle();
    if (savePreferenceError) throw savePreferenceError;
    if (!saved) {
      const { data: current, error: currentError } = await supabase.from('bookings').select('status,payment_init_point,payment_expires_at,balance_payment_init_point,balance_payment_expires_at').eq('id', bookingId).single();
      if (currentError) throw currentError;
      const currentUrl = stage === 'balance' ? current.balance_payment_init_point : current.payment_init_point;
      const currentExpiry = stage === 'balance' ? current.balance_payment_expires_at : current.payment_expires_at;
      if (current.status !== 'pending' || !currentUrl || Date.parse(currentExpiry) <= Date.now()) return res.status(409).json({ error: 'Reserva expirada ou indisponível.' });
      return res.status(200).json({ init_point: currentUrl, promotion_applied: paymentData.promotion_applied, stage, amount: totalAmount });
    }

    res.status(200).json({ init_point: result.init_point, promotion_applied: paymentData.promotion_applied, stage, amount: totalAmount });
  } catch (error) {
    console.error('Erro ao criar preferência:', error.code || error.message);
    res.status(500).json({ error: 'Erro ao processar pagamento' });
  }
}
