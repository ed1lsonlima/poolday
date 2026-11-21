import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { SITE_URL } from '../lib/site'
import { referralLink } from '../lib/referral'
import { ETAPAS, reais, situacao, totaisIndicador } from '../lib/referralProgram'
import useReferralProgram from '../components/referral/useReferralProgram'
import ReferralShare from '../components/referral/ReferralShare'

const dia = value => (value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '')

function Etapas({ etapa }) {
  return <ol className="grid grid-cols-4 gap-1 mt-3" aria-label="Etapas da indicação">{ETAPAS.map((nome, index) => <li key={nome} className="text-center">
    <div className={`h-1.5 rounded-full ${etapa >= index ? 'bg-primary-500' : 'bg-gray-200'}`}/>
    <span className={`block text-[10px] sm:text-xs mt-1 leading-tight ${etapa >= index ? 'text-primary-700 font-semibold' : 'text-gray-400'}`}>{nome}</span>
  </li>)}</ol>
}

const TOM = { bom: 'text-emerald-700', pago: 'text-emerald-700', ruim: 'text-red-700', neutro: 'text-gray-600' }

export default function IndiquePainel() {
  const { user } = useAuth()
  const programa = useReferralProgram()
  const [indicador, setIndicador] = useState(undefined)
  const [lista, setLista] = useState([])

  const carregar = useCallback(async () => {
    const [own, hist] = await Promise.all([
      supabase.from('indicadores').select('codigo,ativo').eq('user_id', user.id).maybeSingle(),
      supabase.rpc('minhas_indicacoes'),
    ])
    if (own.error || hist.error) { toast.error('Não foi possível carregar suas indicações.'); setIndicador(null); return }
    setIndicador(own.data || null)
    setLista(hist.data || [])
  }, [user.id])
  useEffect(() => { carregar() }, [carregar])

  if (indicador === undefined) return <div className="min-h-[50vh] flex items-center justify-center text-sm text-gray-500">Carregando...</div>
  if (!indicador) return <div className="max-w-md mx-auto px-4 py-12 text-center">
    <h1 className="font-bold text-2xl">Você ainda não tem um link</h1>
    <p className="text-sm text-gray-600 mt-2">Pegue seu link na página do programa. Você recebe quando o espaço indicado for cadastrado completo e aprovado pelo PoolDay.</p>
    <Link to="/indique" className="btn-primary inline-block mt-5 py-3 px-6">Pegar meu link</Link>
  </div>

  const { aReceber, pago } = totaisIndicador(lista)
  return <div className="bg-[#f6f9fc] pb-16"><div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 space-y-5">
    <header>
      <p className="text-primary-600 text-xs font-bold tracking-widest uppercase">Minhas indicações</p>
      <h1 className="font-extrabold text-2xl text-gray-900 mt-1">Acompanhe cada indicação</h1>
      <p className="text-sm text-gray-600 mt-1">Você recebe {reais(programa.valor_centavos)} quando o espaço indicado for cadastrado completo e aprovado pelo PoolDay.</p>
    </header>

    <div className="grid grid-cols-3 gap-3">
      <div className="bg-white border border-gray-100 rounded-2xl p-3"><p className="text-xs text-gray-500">A receber</p><p className="font-extrabold text-lg">{reais(aReceber)}</p><p className="text-[11px] text-gray-400">Só o já aprovado</p></div>
      <div className="bg-white border border-gray-100 rounded-2xl p-3"><p className="text-xs text-gray-500">Já pago</p><p className="font-extrabold text-lg">{reais(pago)}</p></div>
      <div className="bg-white border border-gray-100 rounded-2xl p-3"><p className="text-xs text-gray-500">Vagas</p><p className="font-extrabold text-lg">{programa.encerrado ? 'Encerradas' : programa.vagas_restantes}</p><p className="text-[11px] text-gray-400">de {programa.vagas}</p></div>
    </div>

    <section className="bg-white border border-gray-100 rounded-3xl p-5">
      <h2 className="font-bold text-lg mb-3">Seu link</h2>
      {!indicador.ativo && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-xl p-3 mb-3">Seu link foi bloqueado pela equipe PoolDay e não registra novas indicações.</p>}
      <ReferralShare link={referralLink(SITE_URL, indicador.codigo)} codigo={indicador.codigo}/>
    </section>

    <section className="bg-white border border-gray-100 rounded-3xl p-5">
      <h2 className="font-bold text-lg">Suas indicações</h2>
      {lista.length ? <ul className="mt-2 divide-y divide-gray-100">{lista.map(item => { const s = situacao(item); return <li key={item.id} className="py-4">
        <div className="flex justify-between gap-3"><p className="font-semibold text-sm">{item.anfitriao_primeiro_nome}{item.cidade ? <span className="font-normal text-gray-500"> · {item.cidade}</span> : null}</p><span className="text-xs text-gray-400 shrink-0">desde {dia(item.created_at)}</span></div>
        <p className={`text-sm mt-1 ${TOM[s.tom]}`}>{s.texto}</p>
        {s.etapa >= 0 && <Etapas etapa={s.etapa}/>}
      </li> })}</ul> : <p className="text-sm text-gray-500 mt-2">Nenhuma indicação ainda. Quando alguém criar a conta pelo seu link, ela aparece aqui.</p>}
    </section>
    <p className="text-center text-sm"><Link to="/indique/regras" className="font-semibold text-primary-600">Regulamento do programa</Link></p>
  </div></div>
}
