// Redireciona o anfitrião para a tela de autorização do Mercado Pago.
// Uso: <a href="/api/mp-connect?host_id=SEU_UUID">Conectar Mercado Pago</a>
export default async function handler(req, res) {
  const { host_id } = req.query;

  if (!host_id) {
    return res.status(400).json({ error: 'host_id é obrigatório' });
  }

  const clientId = process.env.MP_CLIENT_ID;
  const redirectUri = process.env.MP_REDIRECT_URI || 'https://poolday-self.vercel.app/api/mp-callback';

  if (!clientId) {
    return res.status(500).json({ error: 'MP_CLIENT_ID não configurado no servidor' });
  }

  // host_id vai no "state" pra sabermos, no callback, de qual anfitrião é o token
  const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(host_id)}`;

  res.writeHead(302, { Location: authUrl });
  res.end();
}
