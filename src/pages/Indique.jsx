import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CheckCircle2, ChevronDown, Gift, Info, ShieldCheck, XCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { SITE_URL } from '../lib/site'
import { referralLink } from '../lib/referral'
import { confirmacao, cpfValido, faq, formatCpf, maskWhats, pixValido, PRAZO_PIX_DIAS, reais } from '../lib/referralProgram'
import { trackEvent } from '../lib/visitTracking'
import useReferralProgram from '../components/referral/useReferralProgram'
import ReferralShare from '../components/referral/ReferralShare'

const ERROS = {
  ACEITE_NECESSARIO: 'Marque a caixa de confirmação para continuar.',
  NOME_INVALIDO: 'Informe seu nome.',
  WHATSAPP_INVALIDO: 'Informe um WhatsApp válido com DDD.',
  CPF_INVALIDO: 'Confira o CPF.',
  PIX_INVALIDO: 'Use uma chave Pix válida: CPF, CNPJ, e-mail, celular ou chave aleatória.',
  VAGAS_ENCERRADAS: 'As vagas do programa acabaram. Não é possível gerar links novos.',
  CONTA_SUSPENSA: 'Sua conta está em análise. Fale com o suporte PoolDay.',
}

function Passo({ numero, children }) {
  return <li className="flex gap-3"><span className="w-7 h-7 shrink-0 rounded-full bg-primary-500 text-white text-sm font-bold flex items-center justify-center">{numero}</span><span className="text-sm text-gray-700 pt-1">{children}</span></li>
}

export default function Indique() {
  const { user, profile } = useAuth()
  const programa = useReferralProgram()
  const [params] = useSearchParams()
  const [indicador, setIndicador] = useState(null)
  const [form, setForm] = useState({ nome: '', whatsapp: '', email: '', cpf: '', chave_pix: '' })
  const [aceite, setAceite] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const valor = programa.valor_centavos

  useEffect(() => { trackEvent('indique-visita') }, [])
  useEffect(() => {
    if (!user) return
    setForm(atual => ({ ...atual, nome: atual.nome || profile?.name || '', whatsapp: atual.whatsapp || maskWhats(profile?.phone || ''), email: user.email || '' }))
    supabase.from('indicadores').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (!data) return
      setIndicador(data)
      setForm(atual => ({ ...atual, nome: data.nome || atual.nome, whatsapp: maskWhats(data.whatsapp || ''), cpf: formatCpf(data.cpf || ''), chave_pix: data.chave_pix || '' }))
    })
  }, [user, profile?.name, profile?.phone])

  async function gerar(event) {
    event.preventDefault()
    if (!cpfValido(form.cpf)) return toast.error(ERROS.CPF_INVALIDO)
    if (!pixValido(form.chave_pix)) return toast.error(ERROS.PIX_INVALIDO)
    if (!aceite) return toast.error(ERROS.ACEITE_NECESSARIO)
    setSalvando(true)
    const { data, error } = await supabase.rpc('salvar_indicador', {
      p_nome: form.nome, p_whatsapp: form.whatsapp, p_cpf: form.cpf, p_chave_pix: form.chave_pix, p_aceite: aceite,
      p_utm_source: params.get('utm_source'), p_utm_medium: params.get('utm_medium'), p_utm_campaign: params.get('utm_campaign'),
    })
    setSalvando(false)
    if (error) return toast.error(ERROS[Object.keys(ERROS).find(code => error.message?.includes(code))] || 'Não foi possível salvar. Tente novamente.')
    if (!indicador) trackEvent('indique-link-gerado')
    setIndicador(data)
    toast.success(indicador ? 'Dados atualizados.' : 'Seu link está pronto!')
  }

  const link = indicador ? referralLink(SITE_URL, indicador.codigo) : ''
  const encerrado = programa.encerrado
  return <div className="bg-[#f6f9fc] pb-16"><div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 space-y-5">
    <header>
      <p className="flex items-center gap-2 text-primary-600 text-xs font-bold tracking-widest uppercase"><Gift size={15}/>Indique um anfitrião</p>
      <h1 className="font-extrabold text-2xl sm:text-3xl text-gray-900 mt-2 leading-tight">Conhece alguém que aluga piscina ou chácara? Indique e ganhe {reais(valor)} no Pix quando o espaço dele for aprovado no PoolDay.</h1>
      <p className={`mt-3 text-sm font-semibold ${encerrado ? 'text-red-700' : 'text-orange-700'}`}>{encerrado ? 'Vagas encerradas. Não é possível gerar links novos.' : `Válido para os ${programa.vagas} primeiros espaços aprovados. Restam ${programa.vagas_restantes} vagas.`}</p>
    </header>

    <section className="bg-white border border-gray-100 rounded-3xl p-5">
      <h2 className="font-bold text-lg mb-4">Como funciona</h2>
      <ol className="space-y-3">
        <Passo numero={1}>Pegue seu link.</Passo>
        <Passo numero={2}>Mande pro dono do espaço.</Passo>
        <Passo numero={3}>Ele cria a conta pelo seu link e cadastra o espaço completo: fotos, preço, dias e regras.</Passo>
        <Passo numero={4}>O PoolDay confere se o espaço é real. Aprovou? Você recebe {reais(valor)} no Pix em até {PRAZO_PIX_DIAS} dias.</Passo>
      </ol>
    </section>

    <section className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5">
      <h2 className="font-bold text-lg text-amber-900">Quando você recebe (e quando não recebe)</h2>
      <ul className="mt-3 space-y-2 text-sm text-gray-800">
        <li className="flex gap-2"><CheckCircle2 size={18} className="text-emerald-600 shrink-0"/>Você recebe: quando o espaço indicado for aprovado pelo PoolDay.</li>
        <li className="flex gap-2"><XCircle size={18} className="text-red-600 shrink-0"/>Só indicar não dá dinheiro.</li>
        <li className="flex gap-2"><XCircle size={18} className="text-red-600 shrink-0"/>Só criar a conta não dá dinheiro: precisa cadastrar o espaço completo.</li>
        <li className="flex gap-2"><XCircle size={18} className="text-red-600 shrink-0"/>Espaço falso, copiado da internet ou incompleto não é aprovado e não paga.</li>
        <li className="flex gap-2"><XCircle size={18} className="text-red-600 shrink-0"/>A mesma pessoa não pode indicar a si mesma.</li>
        <li className="flex gap-2"><Info size={18} className="text-primary-600 shrink-0"/>É {reais(valor)} por dono de espaço, uma vez só, mesmo que ele cadastre mais de um espaço.</li>
      </ul>
    </section>

    <section className="bg-white border border-gray-100 rounded-3xl p-5">
      <h2 className="font-bold text-lg">{indicador ? 'Seu link' : 'Pegue seu link'}</h2>
      {indicador && <div className="mt-3 space-y-3">
        <p className="text-sm bg-primary-50 text-primary-900 rounded-xl p-3">Seu link está pronto. Lembre: você recebe {reais(valor)} quando o espaço indicado for cadastrado completo e aprovado pelo PoolDay. Só criar a conta não gera pagamento.</p>
        {!indicador.ativo && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-xl p-3">Seu link foi bloqueado pela equipe PoolDay e não registra novas indicações.</p>}
        <ReferralShare link={link} codigo={indicador.codigo}/>
        <Link to="/indique/painel" className="inline-block text-sm font-semibold text-primary-600">Acompanhar minhas indicações</Link>
      </div>}
      {!user ? <div className="mt-3">
        <p className="text-sm text-gray-600">Para pegar o link e acompanhar suas indicações, entre ou crie sua conta grátis.</p>
        <div className="grid grid-cols-2 gap-2 mt-3"><Link to="/entrar?next=/indique" className="btn-secondary py-3 text-center">Entrar</Link><Link to="/cadastro?next=/indique" className="btn-primary py-3 text-center">Criar conta</Link></div>
      </div> : (encerrado && !indicador) ? <p className="text-sm text-gray-600 mt-3">As vagas acabaram, então não é possível gerar links novos.</p> : <form className="space-y-3 mt-4" onSubmit={gerar}>
        {indicador && <p className="text-sm font-semibold text-gray-700">Seus dados para receber</p>}
        <label className="block text-sm font-semibold text-gray-700">Nome<input className="input-field mt-1 font-normal" autoComplete="name" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required minLength={2} maxLength={80}/></label>
        <label className="block text-sm font-semibold text-gray-700">WhatsApp<input className="input-field mt-1 font-normal" inputMode="numeric" autoComplete="tel" placeholder="(82) 99999-9999" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: maskWhats(e.target.value) }))} required/></label>
        <label className="block text-sm font-semibold text-gray-700">E-mail<input className="input-field mt-1 font-normal bg-gray-50" value={form.email} readOnly aria-readonly="true"/><span className="text-xs font-normal text-gray-500">É o e-mail da sua conta.</span></label>
        <label className="block text-sm font-semibold text-gray-700">CPF<input className="input-field mt-1 font-normal" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: formatCpf(e.target.value) }))} required/></label>
        <label className="block text-sm font-semibold text-gray-700">Chave Pix<input className="input-field mt-1 font-normal" autoComplete="off" placeholder="CPF, e-mail, celular ou chave aleatória" value={form.chave_pix} onChange={e => setForm(f => ({ ...f, chave_pix: e.target.value }))} required maxLength={140}/></label>
        <p className="flex items-start gap-2 text-xs text-gray-500"><ShieldCheck size={14} className="shrink-0 mt-0.5 text-primary-500"/>Pedimos CPF e chave Pix só para pagar o seu Pix e evitar fraude, como alguém indicar a si mesmo. Só a administração do PoolDay vê esses dados.</p>
        {!indicador && <label className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 cursor-pointer"><input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} className="mt-0.5 w-5 h-5 shrink-0 accent-primary-500"/><span className="text-sm text-gray-800">{confirmacao(valor)}</span></label>}
        {indicador && <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} className="mt-0.5 w-5 h-5 shrink-0 accent-primary-500"/><span className="text-xs text-gray-600">Confirmo de novo: {confirmacao(valor)}</span></label>}
        <button disabled={salvando} className="btn-primary w-full py-3 disabled:opacity-60">{salvando ? 'Salvando...' : indicador ? 'Atualizar meus dados' : 'Gerar meu link'}</button>
      </form>}
    </section>

    <section className="bg-white border border-gray-100 rounded-3xl p-5">
      <h2 className="font-bold text-lg mb-2">Perguntas frequentes</h2>
      {faq(programa).map(([pergunta, resposta]) => <details key={pergunta} className="group border-t border-gray-100 py-3">
        <summary className="flex justify-between items-center gap-3 cursor-pointer list-none font-semibold text-sm text-gray-800">{pergunta}<ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180"/></summary>
        <p className="text-sm text-gray-600 mt-2">{resposta}</p>
      </details>)}
    </section>

    <p className="text-center text-sm"><Link to="/indique/regras" className="font-semibold text-primary-600">Ler o regulamento completo</Link></p>
  </div></div>
}
