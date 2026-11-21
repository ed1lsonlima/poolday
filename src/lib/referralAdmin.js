// Contas do programa de indicação usadas pelo servidor (api/admin.js) e pela aba Indicações do Adm.
const digitos = value => String(value || '').replace(/\D/g, '')
const celular = value => digitos(value).replace(/^55(?=\d{10,11}$)/, '').slice(-11)

// Dados iguais entre quem indicou e o anfitrião. Cada item vira um aviso de possível autoindicação.
export function coincidencias(indicador, anfitriao, cpfAnfitriao) {
  if (!indicador || !anfitriao) return []
  const lista = []
  const pix = String(indicador.chave_pix || '').toLowerCase()
  const email = String(anfitriao.email || '').toLowerCase()
  const fone = celular(anfitriao.phone)
  if (indicador.user_id === anfitriao.id) lista.push('mesma conta')
  if (cpfAnfitriao && (cpfAnfitriao === indicador.cpf || cpfAnfitriao === pix)) lista.push('mesmo CPF')
  if (email && (email === String(indicador.email || '').toLowerCase() || email === pix)) lista.push('mesmo e-mail')
  if (fone.length >= 10 && (fone === celular(indicador.whatsapp) || `+55${fone}` === pix)) lista.push('mesmo WhatsApp')
  return lista
}

export function contadoresPrograma({ referrers = [], referrals = [], config } = {}) {
  const valor = status => referrals.filter(item => item.status === status).reduce((total, item) => total + Number(item.valor_centavos || 0), 0)
  const aprovadasComValor = referrals.filter(item => ['a_pagar', 'paga'].includes(item.status) && Number(item.valor_centavos) > 0).length
  return {
    links: referrers.length,
    contas: referrals.length,
    emAnalise: referrals.filter(item => item.status === 'aguardando_aprovacao').length,
    aprovados: referrals.filter(item => ['a_pagar', 'paga'].includes(item.status)).length,
    vagasRestantes: config ? Math.max(0, config.vagas - aprovadasComValor) : null,
    aPagar: valor('a_pagar'),
    pago: valor('paga'),
  }
}

// CPF usado por mais de um indicador.
export function cpfsRepetidos(referrers = []) {
  const vistos = new Map()
  for (const item of referrers) if (item.cpf) vistos.set(item.cpf, [...(vistos.get(item.cpf) || []), item])
  return [...vistos.values()].filter(grupo => grupo.length > 1)
}

export const STATUS_ADMIN = {
  cadastrou: 'Conta criada',
  aguardando_aprovacao: 'Espaço em análise',
  a_pagar: 'Aprovado, a pagar',
  paga: 'Paga',
  recusada: 'Reprovada',
  sem_recompensa: 'Aprovado sem recompensa',
}
