import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

// Callback do OAuth do Mercado Pago. O MP redireciona pra cá com ?code=...&state=host_id
export default async function handler(req, res) {
  const { code, state, error: mpError } = req.query;
  const redirectBase = 'https://poolday-self.vercel.app';

  if (mpError) {
    return res.redirect(`${redirectBase}/anfitriao?mp_error=${encodeURIComponent(mpError)}`);
  }
  if (!code || !state) {
    return res.redirect(`${redirectBase}/anfitriao?mp_error=parametros_ausentes`);
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
        redirect_uri: process.env.MP_REDIRECT_URI || `${redirectBase}/api/mp-callback`,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Erro ao trocar code por token:', tokenData);
      return res.redirect(`${redirectBase}/anfitriao?mp_error=token_invalido`);
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 15552000) * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        mp_user_id: String(tokenData.user_id),
        mp_access_token: tokenData.access_token,
        mp_refresh_token: tokenData.refresh_token,
        mp_public_key: tokenData.public_key || null,
        mp_token_expires_at: expiresAt,
      })
      .eq('id', state);

    if (updateError) throw updateError;

    return res.redirect(`${redirectBase}/anfitriao?mp_connected=1`);
  } catch (err) {
    console.error('Erro no callback do Mercado Pago:', err);
    return res.redirect(`${redirectBase}/anfitriao?mp_error=falha_interna`);
  }
}
