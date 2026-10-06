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

const DIGIT_WORDS = { zero: '0', um: '1', uma: '1', dois: '2', duas: '2', tres: '3', quatro: '4', cinco: '5', seis: '6', sete: '7', oito: '8', nove: '9' }
const NUMBER_WORD = /\b(?:zero|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove)\b/g

function normalizeContactText(value) {
  return String(value || '').normalize('NFKC').normalize('NFD').replace(/[\p{M}\p{Cf}]/gu, '').toLowerCase()
}

function replaceDigitWords(text) {
  return text.replace(NUMBER_WORD, word => DIGIT_WORDS[word])
}

function numericFragment(value) {
  const text = replaceDigitWords(normalizeContactText(value)).trim()
  if (!/^\d[\d\s\p{P}\p{S}]*$/u.test(text)) return null
  const digits = text.replace(/\D/g, '')
  return digits.length > 0 && digits.length < 8 ? digits : null
}

export function fragmentedContactReason(content, recentContents = []) {
  let digits = numericFragment(content)
  if (!digits) return null
  for (const previous of recentContents) {
    const fragment = numericFragment(previous)
    if (!fragment) break
    digits = fragment + digits
    if (digits.length >= 8 && digits.length <= 14) return 'telefone fragmentado'
    if (digits.length > 14) break
  }
  return null
}

export function mayBeContactFragment(value) {
  return numericFragment(value) !== null
}

export function externalContactReason(value) {
  const plain = normalizeContactText(value)
  const compact = plain.replace(/[^a-z0-9]+/g, '')
  const brandText = compact.replace(/4/g, 'a').replace(/3/g, 'e').replace(/1/g, 'i').replace(/0/g, 'o').replace(/5/g, 's')
  if (/(?:https?:\/\/|www\s*[.]|\b(?:wa|t|bit|linktr)\s*[.]\s*(?:me|ly|ee)\b|\b[a-z0-9-]+\s*[.]\s*(?:com|net|org|br)\b|\bponto\s+(?:com|net|org|br)\b)/u.test(plain) || /(?:https?|www|wame|bitly|linktree)/.test(compact)) return 'links'
  if (/@\s*[a-z][\w.]{2,}/u.test(plain) || /\barroba\b/u.test(plain) || /(?:gmail|hotmail|outlook|yahoo)/.test(compact)) return 'redes sociais ou e-mail'
  const withoutDates = replaceDigitWords(plain).replace(/\b(?:0?[1-9]|[12]\d|3[01])[\/.-](?:0?[1-9]|1[0-2])[\/.-](?:20)?\d{2}\b/g, ' ')
  for (const match of withoutDates.matchAll(/\d(?:[\d\s\p{P}\p{S}]*|[a-z](?=\d))*\d/gu)) {
    const digits = match[0].replace(/\D/g, '')
    if (digits.length >= 8 && digits.length <= 14) return 'telefone'
  }
  if (/\b(?:whats?(?:app)?|zap(?:zap)?|insta(?:gram)?|telegram|tiktok|tik\s*tok|facebook|direct|me chama|chama no|me liga|meu numero|meu celular|ddd|chave pix|pagar por fora|pix por fora|sem taxa|fora do (?:site|app|poolday))\b/u.test(plain) || /(?:whatsapp|zapzap|instagram|telegram|tiktok|facebook)/.test(brandText)) return 'contato externo'
  return null
}

