import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Bell, CalendarDays, ExternalLink, Gift, MapPin, MonitorSmartphone, RefreshCw, Users, Wallet, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AdminMFA from '../components/common/AdminMFA'
import { PERIODOS, diaCurto, dinheiro, nomeOrigem, nomePagina, nomeTipo, numero, quando, taxaCadastro } from './painelData'


function Card({ icon: Icon, titulo, children, nota }) {
  return <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3 mb-3"><h2 className="font-bold text-gray-900 flex items-center gap-2">{Icon && <Icon size={18} className="text-primary-500"/>}{titulo}</h2>{nota && <span className="text-xs text-gray-400">{nota}</span>}</div>
    {children}
  </section>
}

function Numero({ rotulo, valor, detalhe, destaque }) {
  return <div className={`rounded-2xl border p-4 ${destaque ? 'bg-primary-500 border-primary-500 text-white' : 'bg-white border-gray-100'}`}>
    <p className={`text-xs ${destaque ? 'text-white/80' : 'text-gray-500'}`}>{rotulo}</p>
    <p className="text-2xl font-extrabold mt-1">{valor}</p>
    {detalhe && <p className={`text-xs mt-1 ${destaque ? 'text-white/80' : 'text-gray-400'}`}>{detalhe}</p>}
  </div>
}

function Barras({ itens, rotulo = item => item.nome }) {
  const maximo = Math.max(1, ...itens.map(item => Number(item.total)))
  if (!itens.length) return <p className="text-sm text-gray-400">Ainda sem dados neste período.</p>
  return <ul className="space-y-2">{itens.map(item => <li key={item.nome}>
    <div className="flex justify-between gap-3 text-sm"><span className="truncate text-gray-700">{rotulo(item)}</span><b className="text-gray-900">{numero(item.total)}</b></div>
    <div className="h-1.5 rounded-full bg-gray-100 mt-1"><div className="h-1.5 rounded-full bg-primary-400" style={{ width: `${(Number(item.total) / maximo) * 100}%` }}/></div>
  </li>)}</ul>
}

function Grafico({ dias }) {
  const maximo = Math.max(1, ...dias.map(d => Number(d.visitantes)))
  return <div>
    <div className="flex items-end gap-1 h-36" role="img" aria-label="Visitantes por dia">
      {dias.map(d => <div key={d.dia} className="flex-1 flex flex-col items-center justify-end h-full" title={`${diaCurto(d.dia)}: ${d.visitantes} visitante(s), ${d.cadastros} cadastro(s)`}>
        <div className="w-full rounded-t bg-primary-400 min-h-[2px]" style={{ height: `${(Number(d.visitantes) / maximo) * 100}%` }}/>
        {Number(d.cadastros) > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#F5A623] mt-1"/>}
      </div>)}
    </div>
    <div className="flex justify-between text-[11px] text-gray-400 mt-2"><span>{dias[0] && diaCurto(dias[0].dia)}</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F5A623]"/>dia com cadastro</span><span>{dias.at(-1) && diaCurto(dias.at(-1).dia)}</span></div>
  </div>
}

function Lista({ itens, vazio, linha }) {
  if (!itens.length) return <p className="text-sm text-gray-400">{vazio}</p>
  return <ul className="divide-y divide-gray-50">{itens.map(linha)}</ul>
}

export function Painel({ fonte = dias => supabase.rpc('painel_dono', { p_dias: dias }) }) {
  const [dias, setDias] = useState(7)
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('')
    const { data, error } = await fonte(dias)
    if (error) setErro(error.code === '42501' ? 'Acesso negado. Entre de novo e confirme o código.' : 'Não foi possível carregar o painel. Tente atualizar.')
    else setDados(data)
    setCarregando(false)
  }, [dias, fonte])
  useEffect(() => { carregar() }, [carregar])

  const v = dados?.visitas
  const taxa = v ? taxaCadastro(v.visitantes, dados.pessoas.novos_no_periodo) : null
  return <main className="min-h-screen bg-[#f6f9fc] pb-12"><div className="max-w-6xl mx-auto px-4 py-5 sm:py-8">
    <header className="flex items-start justify-between gap-3 mb-5">
      <div><p className="text-xs font-bold uppercase tracking-widest text-primary-600">Painel do dono</p><h1 className="font-bold text-2xl sm:text-3xl">PoolDay<span className="text-primary-500">.</span></h1>{dados && <p className="text-xs text-gray-400 mt-1">Atualizado {quando(dados.gerado_em)}. Suas visitas não entram na conta.</p>}</div>
      <div className="flex gap-2 shrink-0">
        <button type="button" onClick={carregar} disabled={carregando} aria-label="Atualizar" className="h-11 w-11 inline-flex items-center justify-center bg-white border border-gray-200 rounded-xl"><RefreshCw size={17} className={carregando ? 'animate-spin' : ''}/></button>
      </div>
    </header>

    <div className="flex gap-2 overflow-x-auto pb-1 mb-5" role="group" aria-label="Período">{PERIODOS.map(([valor, nome]) => <button key={valor} type="button" aria-pressed={dias === valor} onClick={() => setDias(valor)} className={`px-4 py-2 rounded-xl text-sm font-semibold border whitespace-nowrap ${dias === valor ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'}`}>{nome}</button>)}</div>

    {erro && <p role="alert" className="bg-red-50 text-red-700 p-4 rounded-xl mb-5 text-sm">{erro}</p>}
    {!dados ? (!erro && <p className="text-sm text-gray-500">Carregando...</p>) : <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Numero destaque rotulo="Visitantes" valor={numero(v.visitantes)} detalhe={`${numero(v.paginas)} páginas vistas`}/>
        <Numero rotulo="Novos cadastros" valor={numero(dados.pessoas.novos_no_periodo)} detalhe={taxa === null ? 'Sem visitas no período' : `${taxa}% dos visitantes`}/>
        <Numero rotulo="Espaços no ar" valor={numero(dados.espacos.no_ar)} detalhe={`${numero(dados.espacos.em_analise)} em análise`}/>
        <Numero rotulo="Pago pelos clientes" valor={dinheiro(dados.dinheiro.pago_no_periodo)} detalhe={`Total: ${dinheiro(dados.dinheiro.pago_total)}`}/>
      </div>

      <Card icon={BarChart3} titulo="Visitantes por dia" nota={`${numero(v.sessoes)} visitas · ${numero(v.logados)} com conta`}><Grafico dias={v.por_dia}/></Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card icon={ExternalLink} titulo="De onde vieram"><Barras itens={v.origens} rotulo={item => nomeOrigem(item.nome)}/></Card>
        <Card icon={Waves} titulo="Páginas mais vistas"><Barras itens={v.paginas_top} rotulo={item => nomePagina(item.nome)}/></Card>
        <Card icon={MapPin} titulo="Cidades" nota="Aproximadas"><Barras itens={v.cidades}/></Card>
        <Card icon={MonitorSmartphone} titulo="Aparelhos"><Barras itens={v.aparelhos}/></Card>
      </div>
      {v.campanhas.length > 0 && <Card titulo="Campanhas e anúncios" nota="Links com utm"><Barras itens={v.campanhas}/></Card>}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card icon={Users} titulo="Quem entrou com conta" nota="Último acesso no período">
          <Lista itens={dados.pessoas.ultimos_acessos} vazio="Ninguém com conta entrou neste período." linha={p => <li key={`${p.nome}${p.quando}`} className="py-2 flex justify-between gap-3 text-sm"><span className="min-w-0"><b className="block truncate">{p.nome}</b><span className="text-xs text-gray-400">{nomeTipo(p.tipo)} · {nomePagina(p.pagina)}</span></span><span className="text-xs text-gray-400 shrink-0">{quando(p.quando)}</span></li>}/>
        </Card>
        <Card icon={Users} titulo="Últimos cadastros" nota={`${numero(dados.pessoas.clientes)} clientes · ${numero(dados.pessoas.anfitrioes)} anfitriões`}>
          <Lista itens={dados.pessoas.ultimos_cadastros} vazio="Nenhum cadastro ainda." linha={p => <li key={`${p.nome}${p.criado}`} className="py-2 flex justify-between gap-3 text-sm"><span className="min-w-0"><b className="block truncate">{p.nome}</b><span className="text-xs text-gray-400">{nomeTipo(p.tipo)}{p.cidade ? ` · ${p.cidade}` : ''}</span></span><span className="text-xs text-gray-400 shrink-0">{quando(p.criado)}</span></li>}/>
          <p className="text-xs text-gray-400 mt-3">{numero(dados.pessoas.leads_anfitriao)} contatos deixados na página Seja anfitrião.</p>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card icon={Waves} titulo="Espaços"><dl className="text-sm space-y-1.5"><Linha rotulo="No ar" valor={dados.espacos.no_ar}/><Linha rotulo="Em análise" valor={dados.espacos.em_analise}/><Linha rotulo="Pausados" valor={dados.espacos.pausados}/><Linha rotulo="Recusados" valor={dados.espacos.recusados}/></dl></Card>
        <Card icon={CalendarDays} titulo="Reservas"><dl className="text-sm space-y-1.5"><Linha rotulo="Iniciadas no período" valor={dados.reservas.iniciadas_no_periodo}/><Linha rotulo="Confirmadas" valor={dados.reservas.confirmadas}/><Linha rotulo="Aguardando pagamento" valor={dados.reservas.aguardando_pagamento}/><Linha rotulo="Canceladas" valor={dados.reservas.canceladas}/></dl></Card>
        <Card icon={Wallet} titulo="Dinheiro"><dl className="text-sm space-y-1.5"><Linha rotulo="Pago (total)" valor={dinheiro(dados.dinheiro.pago_total)}/><Linha rotulo="Comissão PoolDay" valor={dinheiro(dados.dinheiro.comissao_total)}/><Linha rotulo="Devolvido" valor={dinheiro(dados.dinheiro.devolvido_total)}/></dl><p className="text-xs text-gray-400 mt-2">Pagamentos registrados. Não é o saldo da conta.</p></Card>
        <Card icon={Gift} titulo="Indicações"><dl className="text-sm space-y-1.5"><Linha rotulo="Indicadores" valor={dados.indicacoes.indicadores}/><Linha rotulo="Em andamento" valor={dados.indicacoes.em_andamento}/><Linha rotulo="A pagar" valor={dados.indicacoes.a_pagar}/><Linha rotulo="Pagas" valor={dados.indicacoes.pagas}/></dl></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card icon={CalendarDays} titulo="Próximas reservas">
          <Lista itens={dados.reservas.proximas} vazio="Nenhuma reserva marcada." linha={r => <li key={`${r.data}${r.espaco}`} className="py-2 flex justify-between gap-3 text-sm"><span className="min-w-0"><b>{diaCurto(r.data)}</b> <span className="text-gray-600">{r.espaco}</span></span><span className="text-xs text-gray-500 shrink-0">{r.status === 'confirmed' ? 'Confirmada' : 'Pendente'} · {dinheiro(r.total)}</span></li>}/>
        </Card>
        <Card icon={Bell} titulo="Alertas abertos" nota={`${numero(dados.alertas.urgentes)} urgente(s)`}>
          <Lista itens={dados.alertas.lista} vazio="Nenhum alerta aberto." linha={a => <li key={`${a.titulo}${a.quando}`} className="py-2 flex justify-between gap-3 text-sm"><span className={a.gravidade === 'urgent' ? 'text-red-700 font-semibold' : 'text-gray-700'}>{a.titulo}</span><span className="text-xs text-gray-400 shrink-0">{quando(a.quando)}</span></li>}/>
          <Link to="/admin" className="inline-block text-sm font-semibold text-primary-600 mt-3">Resolver no Adm</Link>
        </Card>
      </div>
    </div>}
  </div></main>
}

function Linha({ rotulo, valor }) {
  return <div className="flex justify-between gap-3"><dt className="text-gray-500">{rotulo}</dt><dd className="font-bold text-gray-900">{typeof valor === 'number' ? numero(valor) : valor}</dd></div>
}

export default function PainelApp() {
  const [nivel, setNivel] = useState(null)
  useEffect(() => {
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => setNivel(data?.currentLevel || 'aal1'))
  }, [])
  if (!nivel) return <main className="min-h-[60vh] flex items-center justify-center text-sm text-gray-500">Carregando...</main>
  if (nivel !== 'aal2') return <main className="min-h-screen bg-[#f6f9fc] p-4"><AdminMFA onVerified={() => setNivel('aal2')}/></main>
  return <Painel/>
}
