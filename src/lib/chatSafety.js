export const CHAT_NOTICE_VERSION = '2026-09-24-v1'

export const CHAT_NOTICES = {
  client: {
    title: 'Mantenha sua reserva protegida',
    paragraphs: [
      'Combine os detalhes da diária por este chat e faça os pagamentos pelo PoolDay. Pagamentos feitos por fora não ficam registrados na sua reserva e as regras de cancelamento e reembolso do PoolDay não se aplicam a esses valores.',
      'Não envie telefone, redes sociais ou links para combinar a locação fora da plataforma. A equipe PoolDay pode consultar as conversas para prestar suporte e verificar possíveis descumprimentos das regras.',
    ],
  },
  host: {
    title: 'Atenda o cliente pelo PoolDay',
    paragraphs: [
      'Use este chat para combinar a chegada e esclarecer dúvidas sobre a reserva. Não peça pagamentos por fora nem envie telefone, redes sociais ou links para fechar a locação fora da plataforma.',
      'Negociações por fora deixam de ter o registro da plataforma e podem resultar em medidas na sua conta conforme as regras do PoolDay. A equipe PoolDay pode consultar as conversas para prestar suporte e verificar possíveis descumprimentos.',
    ],
  },
}

export const QUICK_MESSAGES = {
  client: ['Como chegar ao espaço?', 'Qual é o horário de entrada?', 'Vou me atrasar.', 'Preciso de ajuda com a reserva.'],
  host: ['Olá! Posso ajudar com a chegada.', 'Confira as instruções de acesso na sua reserva.', 'Estarei no local para receber você.', 'Um responsável receberá você.'],
}

export function bookingChatWritable(booking) {
  return ['pending', 'confirmed'].includes(booking?.status)
    && Number(booking?.paid_amount) > 0
    && ['deposit_paid', 'awaiting_balance', 'fully_paid'].includes(booking?.payment_state)
    && !booking?.cancelled_at
}

export function externalContactReason(value) {
  const text = String(value || '').normalize('NFKC')
  const plain = text.toLowerCase()
  if (/(?:https?:\/\/|www\.|wa\.me\/|t\.me\/|bit\.ly\/|linktr\.ee\/|instagram\.com|facebook\.com|tiktok\.com)/i.test(text)) return 'links'
  if (/[\w.+-]+\s*@\s*[\w.-]+\.[a-z]{2,}/i.test(text) || /@[a-z][\w.]{2,}/i.test(text)) return 'redes sociais ou e-mail'
  if (/(?:\+?55[\s().-]*)?(?:\(?\d{2}\)?[\s().-]*)?9?\d{4}[\s().-]*\d{4}\b/.test(text)) return 'telefone'
  if (/\b(?:whats(?:app)?|insta(?:gram)?|telegram|direct|me chama|chama no|pagar por fora|pix por fora|sem taxa|fora do (?:site|app|poolday))\b/i.test(plain)) return 'contato externo'
  return null
}

