import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SITE_URL = process.env.SITE_URL || 'https://poolday-self.vercel.app';

// Gera a URL de autorização do Mercado Pago para o anfitrião LOGADO.
// Segurança: o host_id NÃO vem da query string — vem do token de sessão do
// Supabase. Sem isso, qualquer pessoa poderia conectar a própria conta MP
// no perfil de outro anfitrião e desviar os repasses dele.
export default async function handler(req, res) {
  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) return res.status(401).json({ error: 'Faça login para conectar sua conta.' });

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });

  const clientId = process.env.MP_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'MP_CLIENT_ID não configurado no servidor' });

  const redirectUri = process.env.MP_REDIRECT_URI || `${SITE_URL}/api/mp-callback`;

  // state assinado: host_id.hmac — o callback confere a assinatura antes de salvar.
  const secret = process.env.MP_STATE_SECRET || process.env.MP_CLIENT_SECRET;
  const sig = crypto.createHmac('sha256', secret).update(user.id).digest('hex').slice(0, 32);
  const state = `${user.id}.${sig}`;

  const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

  res.status(200).json({ url: authUrl });
}
