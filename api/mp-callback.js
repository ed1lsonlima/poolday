import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SITE_URL = process.env.SITE_URL || 'https://poolday-self.vercel.app';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { code, state, error: mpError } = req.query;

  if (mpError) {
    return res.redirect(`${SITE_URL}/anfitriao?mp_error=${encodeURIComponent(mpError)}`);
  }
  if (!code || !state) {
    return res.redirect(`${SITE_URL}/anfitriao?mp_error=parametros_ausentes`);
  }

  const [hostId, sig] = String(state).split('.');
  const secret = process.env.MP_STATE_SECRET || process.env.MP_CLIENT_SECRET;
  const expected = crypto.createHmac('sha256', secret).update(hostId || '').digest('hex').slice(0, 32);
  if (!hostId || !sig || sig !== expected) {
    return res.redirect(`${SITE_URL}/anfitriao?mp_error=state_invalido`);
  }

  try {
    const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.MP_CLIENT_ID,
        client_secret: process.env.MP_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.MP_REDIRECT_URI || `${SITE_URL}/api/mp-callback`,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Erro ao trocar code por token:', JSON.stringify(tokenData));
      return res.redirect(`${SITE_URL}/anfitriao?mp_error=token_invalido`);
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 15552000) * 1000).toISOString();

    // Usa funcao SQL (SECURITY DEFINER) pra contornar limitacao do PostgREST
    const { error: rpcError } = await supabase.rpc('upsert_mp_credentials', {
      p_host_id: hostId,
      p_mp_user_id: String(tokenData.user_id),
      p_mp_access_token: tokenData.access_token,
      p_mp_refresh_token: tokenData.refresh_token,
      p_mp_public_key: tokenData.public_key || '',
      p_mp_token_expires_at: expiresAt,
    });

    if (rpcError) {
      console.error('Erro ao salvar credenciais via RPC:', JSON.stringify(rpcError));
      return res.redirect(`${SITE_URL}/anfitriao?mp_error=falha_salvar`);
    }

    return res.redirect(`${SITE_URL}/anfitriao?mp_connected=1`);
  } catch (err) {
    console.error('Erro no callback do Mercado Pago:', err);
    return res.redirect(`${SITE_URL}/anfitriao?mp_error=falha_interna`);
  }
}
