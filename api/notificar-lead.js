// ============================================================================
//  api/notificar-lead.js
//  Avisa o Edilson por e-mail toda vez que um anfitrião novo preenche o
//  formulário da landing /seja-anfitriao.
//
//  Quem chama: um Database Webhook do Supabase, disparado no INSERT da
//  tabela leads_anfitriao. O gatilho é o dado gravado no banco — se o lead
//  existe, o e-mail sai (não depende do navegador da pessoa).
//
//  Variáveis de ambiente necessárias no Vercel:
//    RESEND_API_KEY     -> chave da conta do Resend (re_...)
//    NOTIFICAR_EMAIL    -> para onde mandar o aviso
//    WEBHOOK_SECRET     -> senha combinada com o webhook do Supabase
//    RESEND_FROM        -> (opcional) remetente. Sem domínio verificado,
//                          deixe em branco que usa onboarding@resend.dev
// ============================================================================

const REMETENTE_PADRAO = 'PoolDay <onboarding@resend.dev>';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Só o webhook do Supabase conhece o segredo. Sem isso, qualquer um que
  // descobrisse a URL poderia encher a caixa de entrada de lead falso.
  const segredo = process.env.WEBHOOK_SECRET;
  if (!segredo || req.headers['x-poolday-secret'] !== segredo) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const destino = process.env.NOTIFICAR_EMAIL;
  if (!apiKey || !destino) {
    console.error('Faltando RESEND_API_KEY ou NOTIFICAR_EMAIL no ambiente');
    return res.status(500).json({ error: 'Servidor sem configuração de e-mail' });
  }

  // O Supabase manda { type, table, record, old_record }
  const lead = (req.body && (req.body.record || req.body)) || {};
  const nome = lead.nome || 'Sem nome';
  const whatsapp = String(lead.whatsapp || '').replace(/\D/g, '');
  const cidade = lead.cidade || 'não informada';
  const tipo = lead.tipo_espaco || 'não informado';
  const origem = lead.origem || '-';

  const whatsFormatado = whatsapp.length >= 10
    ? `(${whatsapp.slice(0, 2)}) ${whatsapp.slice(2, -4)}-${whatsapp.slice(-4)}`
    : whatsapp || 'não informado';

  const mensagem = encodeURIComponent(
    `Oi ${nome.split(' ')[0]}! Aqui é do PoolDay. Vi que você se interessou em anunciar seu espaço. ` +
    `Posso te ajudar a colocar ele no ar? Se preferir, eu faço o cadastro pra você.`
  );
  const linkWhats = whatsapp
    ? `https://wa.me/55${whatsapp}?text=${mensagem}`
    : null;

  const html = `
<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
  <div style="background:#1a6dbf;color:#fff;padding:20px 24px;border-radius:14px 14px 0 0">
    <p style="margin:0;font-size:13px;opacity:.85">PoolDay</p>
    <h1 style="margin:4px 0 0;font-size:21px">Chegou um anfitrião novo</h1>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px;padding:22px 24px">
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      <tr><td style="padding:7px 0;color:#6b7280;width:110px">Nome</td><td style="padding:7px 0;font-weight:600">${nome}</td></tr>
      <tr><td style="padding:7px 0;color:#6b7280">WhatsApp</td><td style="padding:7px 0;font-weight:600">${whatsFormatado}</td></tr>
      <tr><td style="padding:7px 0;color:#6b7280">Cidade</td><td style="padding:7px 0;font-weight:600">${cidade}</td></tr>
      <tr><td style="padding:7px 0;color:#6b7280">Espaço</td><td style="padding:7px 0;font-weight:600">${tipo}</td></tr>
      <tr><td style="padding:7px 0;color:#6b7280">Origem</td><td style="padding:7px 0">${origem}</td></tr>
    </table>
    ${linkWhats ? `
    <a href="${linkWhats}"
       style="display:block;margin-top:20px;background:#F5A623;color:#1f2937;text-decoration:none;
              font-weight:700;text-align:center;padding:15px;border-radius:12px;font-size:16px">
      Chamar no WhatsApp agora
    </a>
    <p style="margin:14px 0 0;font-size:13px;color:#6b7280;text-align:center">
      Responder no mesmo dia é o que transforma lead em espaço no ar.
    </p>` : ''}
  </div>
</div>`.trim();

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || REMETENTE_PADRAO,
        to: [destino],
        subject: `Novo anfitrião: ${nome} - ${cidade}`,
        html,
      }),
    });

    if (!r.ok) {
      const detalhe = await r.text();
      console.error('Resend recusou o envio:', r.status, detalhe);
      return res.status(502).json({ error: 'Falha ao enviar e-mail', detalhe });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Erro ao notificar lead:', e);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
