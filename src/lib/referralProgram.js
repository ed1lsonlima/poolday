// Textos e regras do programa "Indique um anfitrião". O valor e as vagas vêm do banco: aqui só formatamos.
// Regra de ouro: o valor nunca aparece sem a condição (espaço cadastrado completo e aprovado).

export const PROGRAMA_PADRAO = { ativo: true, valor_centavos: 3000, vagas: 20, vagas_restantes: 20, encerrado: false }
export const PRAZO_PIX_DIAS = 7
export const PRAZO_ANALISE_DIAS = 3
export const PRAZO_LINK_DIAS = 60
export const TOLERANCIA_DIAS = 30

export const reais = cents => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2 })

export function cpfValido(value) {
  const d = String(value || '').replace(/\D/g, '')
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false
  const digito = length => {
    let soma = 0
    for (let i = 0; i < length; i++) soma += Number(d[i]) * (length + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10])
}

export function formatCpf(value) {
  const d = String(value || '').replace(/\D/g, '').slice(0, 11)
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

export function maskWhats(value) {
  const d = String(value || '').replace(/\D/g, '').replace(/^55(?=\d{11}$)/, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

// Conferência rápida na tela. O servidor valida de novo e normaliza a chave.
export function pixValido(value) {
  const v = String(value || '').trim()
  const d = v.replace(/\D/g, '')
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return true
  if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v)) return true
  if (/^[\d.\-/ ]+$/.test(v) && (cpfValido(d) || d.length === 14)) return true
  return /^\+?[\d() -]+$/.test(v) && /^(55)?[1-9]\d9\d{8}$/.test(d)
}

export const mensagemWhatsApp = link => `Oi! Você que tem piscina ou chácara, conhece o PoolDay? É um site só de aluguel de espaço por diária, o cadastro é grátis e você controla preço, datas e regras. Cadastra por aqui: ${link}`
export const linkWhatsApp = link => `https://wa.me/?text=${encodeURIComponent(mensagemWhatsApp(link))}`

export const confirmacao = valor => `Entendi que só recebo os ${reais(valor)} quando o espaço que eu indiquei for cadastrado completo e aprovado pelo PoolDay. Só indicar ou só criar a conta não gera pagamento.`

export const ETAPAS = ['Conta criada', 'Espaço cadastrado', 'Aprovado', 'Pago']

// Status em linguagem simples, sempre dizendo se já existe dinheiro ou não.
export function situacao(item) {
  switch (item.status) {
    case 'cadastrou': return { etapa: 0, texto: 'Criou a conta (ainda sem valor: falta cadastrar o espaço completo)', tom: 'neutro' }
    case 'aguardando_aprovacao': return { etapa: 1, texto: 'Espaço em análise (ainda sem valor: aguardando aprovação)', tom: 'neutro' }
    case 'a_pagar': return { etapa: 2, texto: `Aprovado: ${reais(item.valor_centavos)}, Pix em até ${PRAZO_PIX_DIAS} dias`, tom: 'bom' }
    case 'paga': return { etapa: 3, texto: 'Pago', tom: 'pago' }
    case 'sem_recompensa': return { etapa: 2, texto: `Aprovado sem recompensa: ${item.motivo || 'as vagas acabaram antes da aprovação'}`, tom: 'ruim' }
    default: return { etapa: -1, texto: `Não aprovado: ${item.motivo || 'não atendeu às regras do programa'}`, tom: 'ruim' }
  }
}

export function totaisIndicador(lista = []) {
  const soma = status => lista.filter(item => item.status === status).reduce((total, item) => total + Number(item.valor_centavos || 0), 0)
  return { aReceber: soma('a_pagar'), pago: soma('paga') }
}

export const faq = ({ valor_centavos: valor }) => [
  ['Ganho só por indicar?', 'Não. Você ganha quando o espaço indicado for cadastrado completo e aprovado pelo PoolDay.'],
  ['E se ele só criar a conta?', 'Ainda não ganha. Ele precisa cadastrar o espaço com fotos, preço, dias e regras, e o PoolDay aprovar.'],
  ['Como o PoolDay confere se o espaço é real?', 'A gente analisa o anúncio e pode pedir ao dono um vídeo curto ou uma chamada rápida mostrando o espaço.'],
  ['Quanto tempo leva?', `A análise costuma levar até ${PRAZO_ANALISE_DIAS} dias depois que o anúncio está completo. O Pix cai em até ${PRAZO_PIX_DIAS} dias depois da aprovação.`],
  ['Quanto recebo?', `${reais(valor)} por dono de espaço indicado e aprovado, uma vez só, mesmo que ele cadastre mais de um espaço.`],
  ['Precisa ter reserva?', 'Não. Basta o espaço indicado ser aprovado.'],
  ['Posso indicar quantos?', 'Quantos quiser, enquanto houver vagas.'],
  ['Como acompanho?', 'Pelo seu painel de indicações, que mostra a etapa de cada indicação e se já tem valor ou não.'],
]
