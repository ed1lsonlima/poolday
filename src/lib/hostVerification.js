// Verificação do anfitrião: o cadastro é livre, e os documentos têm prazo depois do primeiro espaço.

const POOLDAY_WHATSAPP = '5582996987838'
const DAY_MS = 24 * 60 * 60 * 1000

export const VERIFICATION_STEPS = [
  'Foto do RG ou da CNH, frente e verso.',
  'Selfie segurando o documento.',
  'Sua chave Pix, que precisa estar no mesmo nome do documento.',
  'Vídeo curto mostrando o portão e o espaço anunciado.',
]

export const VISIT_CONSENT_TEXT = 'Concordo que o PoolDay pode visitar este espaço, com aviso prévio, para conferir se ele corresponde ao anúncio.'

export function verificationWhatsappLink() {
  const message = 'Olá, equipe PoolDay! Quero verificar minha conta de anfitrião. Vou enviar meus documentos.'
  return `https://wa.me/${POOLDAY_WHATSAPP}?text=${encodeURIComponent(message)}`
}

// Sem prazo ou já verificado: nada a mostrar. O prazo só existe para quem cadastrou o primeiro espaço.
export function verificationStatus(dueAt, verified, now = Date.now()) {
  if (verified || !dueAt) return { state: 'none', daysLeft: null }
  const remaining = Date.parse(dueAt) - now
  if (!Number.isFinite(remaining)) return { state: 'none', daysLeft: null }
  return remaining <= 0 ? { state: 'overdue', daysLeft: 0 } : { state: 'pending', daysLeft: Math.ceil(remaining / DAY_MS) }
}
