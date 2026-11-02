import { Copy, Gift, Link2, ShieldCheck } from 'lucide-react'
import { REFERRAL_STATUS } from '../../lib/referral'

const money = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const day = value => value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'

export const REFERRAL_RULES = [
  'Você ganha R$ 20 por anfitrião novo que se cadastrar pelo seu link, pagos por Pix quando o primeiro espaço dele for aprovado pela equipe PoolDay.',
  'Vale uma vez por anfitrião. Quem já tem conta no PoolDay não conta como indicação nova.',
  'Não vale indicar a si mesmo: bloqueamos e-mail, telefone ou chave Pix iguais aos do anfitrião.',
  'Um nível só: você não ganha pelas indicações de quem você indicou.',
  'Até 10 indicações pagas por pessoa por mês.',
  'É proibido envio em massa ou spam. Nesses casos, o link e o pagamento podem ser cancelados.',
]

// Tela de /indique-e-ganhe sem acesso a dados: recebe tudo por props.
export default function ReferralView({ link, form, onChange, onSave, saving, inactive, history, notClient, onCopy }) {
  return <div className="min-h-screen bg-[#f6f9fc] pb-12"><div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
    <header>
      <p className="flex items-center gap-2 text-primary-600 text-xs font-bold tracking-widest uppercase"><Gift size={15}/>Indique e ganhe</p>
      <h1 className="font-bold text-2xl sm:text-3xl text-gray-900 mt-2">Indique um dono de espaço e ganhe R$ 20</h1>
    </header>

    <p className="bg-orange-50 border border-orange-100 text-orange-900 text-sm leading-relaxed p-4 rounded-2xl">
      O PoolDay está em lançamento. Estamos abrindo cidade por cidade e os primeiros espaços estão sendo cadastrados agora.
      Quer ajudar? Indique um dono de espaço e ganhe R$ 20 quando o espaço dele for aprovado.
    </p>

    {notClient ? <section className="bg-white border border-gray-100 rounded-3xl p-5">
      <h2 className="font-bold text-lg">Programa para contas de cliente</h2>
      <p className="text-sm text-gray-500 mt-2">Para indicar, use uma conta de cliente do PoolDay. Contas de anfitrião não participam como indicadoras.</p>
    </section> : <>
      <section className="bg-white border border-gray-100 rounded-3xl p-5">
        <h2 className="font-bold text-lg flex items-center gap-2"><Link2 size={18} className="text-primary-500"/>Seu link</h2>
        {link ? <>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input readOnly aria-label="Seu link de indicação" value={link} className="input-field flex-1 text-sm" onFocus={event => event.target.select()}/>
            <button type="button" onClick={onCopy} className="btn-primary inline-flex items-center justify-center gap-2 whitespace-nowrap"><Copy size={16}/>Copiar link</button>
          </div>
          {inactive && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-xl p-3 mt-3">Seu link foi desativado pela equipe PoolDay e não registra novas indicações.</p>}
          <p className="text-xs text-gray-400 mt-3">Envie para quem você conhece e tem piscina, chácara ou área de lazer. Nada de envio em massa.</p>
        </> : <p className="text-sm text-gray-500 mt-2">Preencha seus dados abaixo para gerar o seu link.</p>}
      </section>

      <section className="bg-white border border-gray-100 rounded-3xl p-5">
        <h2 className="font-bold text-lg">Seus dados para receber</h2>
        <form className="space-y-3 mt-3" onSubmit={event => { event.preventDefault(); onSave() }}>
          <label className="block text-sm font-semibold text-gray-700" htmlFor="ref-nome">Nome
            <input id="ref-nome" className="input-field mt-1 font-normal" autoComplete="name" value={form.nome} onChange={event => onChange({ nome: event.target.value })} required minLength={2} maxLength={80}/>
          </label>
          <label className="block text-sm font-semibold text-gray-700" htmlFor="ref-whats">WhatsApp
            <input id="ref-whats" className="input-field mt-1 font-normal" inputMode="numeric" autoComplete="tel" placeholder="(82) 99999-9999" value={form.whatsapp} onChange={event => onChange({ whatsapp: event.target.value })} required/>
          </label>
          <label className="block text-sm font-semibold text-gray-700" htmlFor="ref-pix">Chave Pix
            <input id="ref-pix" className="input-field mt-1 font-normal" autoComplete="off" value={form.chave_pix} onChange={event => onChange({ chave_pix: event.target.value })} required minLength={5} maxLength={140}/>
          </label>
          <p className="flex items-start gap-2 text-xs text-gray-500"><ShieldCheck size={14} className="shrink-0 mt-0.5 text-primary-500"/>A chave Pix é usada apenas para pagar sua indicação. Só a administração do PoolDay vê esse dado.</p>
          <button disabled={saving} className="btn-primary w-full disabled:opacity-60">{saving ? 'Salvando...' : link ? 'Atualizar dados' : 'Gerar meu link'}</button>
        </form>
      </section>
    </>}

    <section className="bg-white border border-gray-100 rounded-3xl p-5">
      <h2 className="font-bold text-lg">Regras</h2>
      <ul className="mt-3 space-y-2 text-sm text-gray-600 list-disc pl-5">{REFERRAL_RULES.map(rule => <li key={rule}>{rule}</li>)}</ul>
    </section>

    {!notClient && <section className="bg-white border border-gray-100 rounded-3xl p-5">
      <h2 className="font-bold text-lg">Suas indicações</h2>
      {history.length ? <ul className="mt-3 divide-y divide-gray-100">{history.map(item => <li key={item.id} className="py-3 flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="font-semibold text-sm">{item.anfitriao_primeiro_nome}</p><p className="text-xs text-gray-400">Desde {day(item.created_at)}{item.paga_em ? ` · paga em ${day(item.paga_em)}` : ''}</p></div>
        <div className="text-right shrink-0"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'paga' ? 'bg-emerald-50 text-emerald-700' : item.status === 'recusada' ? 'bg-gray-100 text-gray-500' : item.status === 'a_pagar' ? 'bg-orange-50 text-orange-700' : 'bg-sky-50 text-sky-700'}`}>{REFERRAL_STATUS[item.status] || item.status}</span><p className="text-xs text-gray-500 mt-1">{money(item.valor_centavos)}</p></div>
      </li>)}</ul> : <p className="text-sm text-gray-400 mt-3">Nenhuma indicação ainda.</p>}
    </section>}
  </div></div>
}
