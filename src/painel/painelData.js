// Textos e contas do painel do dono, separados da tela para poderem ser testados.
export const PERIODOS = [[1, 'Hoje'], [7, '7 dias'], [30, '30 dias'], [90, '90 dias']]

const ORIGENS = { direto: 'Direto ou link salvo', instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', whatsapp: 'WhatsApp', google: 'Google' }
export const nomeOrigem = nome => ORIGENS[nome] || nome

const PAGINAS = { '/': 'Página inicial', '/explorar': 'Explorar espaços', '/seja-anfitriao': 'Seja anfitrião', '/cadastro': 'Criar conta', '/entrar': 'Entrar', '/anfitriao': 'Painel do anfitrião', '/reservas': 'Minhas reservas', '/admin': 'Administração', '/indique-e-ganhe': 'Indique e ganhe' }
export function nomePagina(path) {
  if (PAGINAS[path]) return PAGINAS[path]
  if (path.startsWith('/espaco/')) return 'Página de um espaço'
  if (path.startsWith('/anfitriao/')) return 'Área do anfitrião'
  if (path.startsWith('/reserva/')) return 'Conversa de reserva'
  if (path.startsWith('/i/')) return 'Link de indicação'
  if (path === '/indique') return 'Indique um anfitrião'
  if (path === '/indique/painel') return 'Painel do indicador'
  if (path === '/_evento/indique-visita') return 'Evento: visita ao Indique'
  if (path === '/_evento/indique-link-gerado') return 'Evento: link de indicação gerado'
  if (path === '/_evento/indique-whatsapp') return 'Evento: clique em Mandar no WhatsApp'
  if (path === '/_evento/visita-com-ref') return 'Evento: visita com link de indicação'
  if (path === '/_evento/anfitriao-indicado') return 'Evento: conta de anfitrião por indicação'
  return path
}

export const nomeTipo = tipo => (tipo === 'host' ? 'Anfitrião' : tipo === 'client' ? 'Cliente' : 'Conta')

export const dinheiro = valor => `R$ ${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const numero = valor => Number(valor || 0).toLocaleString('pt-BR')

export function quando(iso, agora = Date.now()) {
  const diff = agora - Date.parse(iso)
  if (!Number.isFinite(diff)) return ''
  const minutos = Math.round(diff / 60000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `há ${horas} h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Maceio' })
}

export const diaCurto = dia => {
  const [, mes, d] = String(dia).split('-')
  return `${d}/${mes}`
}

// Conversão de visitante em cadastro no período. Sem visitantes, não há taxa.
export function taxaCadastro(visitantes, cadastros) {
  if (!visitantes) return null
  return Math.round((cadastros / visitantes) * 1000) / 10
}
