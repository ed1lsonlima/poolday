import { useState } from 'react'
import { Gift, Link2, Settings, TriangleAlert, Users, Wallet } from 'lucide-react'
import { dayBR, money } from '../../lib/adminReports'
import { contadoresPrograma, cpfsRepetidos, STATUS_ADMIN } from '../../lib/referralAdmin'
import { Badge, Chips, Collapsible, CopyButton, Empty, ExportButton, Metric } from './AdminUI'
import ReferralReview from './ReferralReview'

const cents = value => money(Number(value || 0) / 100)
const primaryBtn = 'inline-flex items-center justify-center rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50'
const ghostBtn = 'inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold px-4 py-2.5 disabled:opacity-50'

function Configuracao({ config, onSave, busy }) {
  const [form, setForm] = useState({ valor: (config.valor_centavos / 100).toFixed(2), vagas: config.vagas, ativo: config.ativo, motivo: '' })
  const valido = Number(form.valor) >= 1 && Number.isInteger(Number(form.vagas)) && Number(form.vagas) >= 1 && form.motivo.trim().length >= 5
  return <form className="px-5 pb-5 grid sm:grid-cols-2 gap-3" onSubmit={event => { event.preventDefault(); onSave({ valor_centavos: Math.round(Number(form.valor) * 100), vagas: Number(form.vagas), ativo: form.ativo }, form.motivo.trim()) }}>
    <label className="text-sm font-semibold text-gray-700">Valor por anfitrião (R$)<input className="input-field mt-1 font-normal" type="number" min="1" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}/></label>
    <label className="text-sm font-semibold text-gray-700">Vagas (espaços aprovados com recompensa)<input className="input-field mt-1 font-normal" type="number" min="1" step="1" value={form.vagas} onChange={e => setForm(f => ({ ...f, vagas: e.target.value }))}/></label>
    <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2"><input type="checkbox" className="w-4 h-4 accent-primary-500" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}/>Programa ligado (desligar para de gerar links novos; quem já estava em andamento tem a tolerância de {config.tolerancia_dias} dias)</label>
    <input className="input-field sm:col-span-2" placeholder="Motivo da mudança (fica na auditoria)" value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}/>
    <button disabled={busy || !valido} className={`${primaryBtn} sm:col-span-2`}>Salvar configuração</button>
  </form>
}

export default function ReferralTab({ data, usersById, propertiesById, ask, onAction, showProperty, acting }) {
  const [filtro, setFiltro] = useState('aguardando_aprovacao')
  const referrers = data.referrers || []
  const referrals = data.referrals || []
  const config = data.referralConfig
  const porIndicador = new Map(referrers.map(item => [item.user_id, item]))
  const c = contadoresPrograma({ referrers, referrals, config })
  const lista = referrals.filter(item => filtro === 'all' || item.status === filtro)
  const suspeitas = [
    ...referrals.filter(item => item.coincidencias?.length && !['recusada'].includes(item.status)).map(item => ({ id: `c${item.id}`, texto: `${porIndicador.get(item.indicador_id)?.nome || 'Indicador'} e ${usersById.get(item.anfitriao_id)?.name || 'anfitrião'}: ${item.coincidencias.join(', ')}` })),
    ...cpfsRepetidos(referrers).map(grupo => ({ id: `cpf${grupo[0].cpf}`, texto: `Mesmo CPF em indicadores diferentes: ${grupo.map(item => item.nome).join(', ')}` })),
    ...(data.events || []).filter(event => event.kind === 'referral_self' && !event.resolved_at).map(event => ({ id: event.id, texto: `${event.title}. ${event.detail || ''}` })),
  ]

  async function aprovar(item, checklist, observacao) {
    await onAction({ action: 'aprovar_indicado', id: item.id, reason: observacao, checklist })
  }

  return <div className="space-y-4">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Metric label="Links gerados" value={c.links} icon={Link2}/>
      <Metric label="Contas criadas por indicação" value={c.contas} icon={Users}/>
      <Metric label="Espaços em análise" value={c.emAnalise} icon={Gift} accent={c.emAnalise > 0}/>
      <Metric label="Aprovados" value={c.aprovados} note={config ? `${c.vagasRestantes} de ${config.vagas} vagas restantes` : undefined} icon={Gift}/>
      <Metric label="A pagar" value={cents(c.aPagar)} icon={Wallet} accent={c.aPagar > 0}/>
      <Metric label="Pago" value={cents(c.pago)} icon={Wallet}/>
    </div>
    {config && <p className="text-xs text-gray-500">{config.ativo && !config.encerrado_em ? 'Programa ligado' : `Programa encerrado${config.encerrado_em ? ` em ${dayBR(config.encerrado_em)}` : ''}`}: {cents(config.valor_centavos)} por anfitrião, pagos quando você aprova o primeiro espaço dele, para os {config.vagas} primeiros aprovados. Pix manual em até 7 dias.</p>}

    {suspeitas.length > 0 && <section className="bg-red-50 border border-red-200 rounded-2xl p-4"><p className="font-bold text-red-800 flex items-center gap-2"><TriangleAlert size={18}/>Alertas de suspeita</p><ul className="mt-2 space-y-1 text-sm text-red-900 list-disc pl-5">{suspeitas.map(item => <li key={item.id}>{item.texto}</li>)}</ul></section>}

    <Chips label="Filtrar indicações" value={filtro} onChange={setFiltro} options={[['aguardando_aprovacao', 'Em análise', c.emAnalise], ['cadastrou', 'Conta criada'], ['a_pagar', 'A pagar'], ['paga', 'Pagas'], ['sem_recompensa', 'Sem recompensa'], ['recusada', 'Reprovadas'], ['all', 'Todas']]}/>
    <div className="flex justify-end"><ExportButton name="indicacoes" rows={lista.map(item => { const ind = porIndicador.get(item.indicador_id); return { indicador: ind?.nome, chave_pix: ind?.chave_pix, whatsapp: ind?.whatsapp, anfitriao: usersById.get(item.anfitriao_id)?.name, valor: Number(item.valor_centavos) / 100, status: STATUS_ADMIN[item.status], cadastro: item.created_at, aprovada: item.aprovada_em, paga: item.paga_em, observacao: item.pagamento_observacao || item.recusa_motivo } })}/></div>

    <ul className="space-y-3">{lista.map(item => { const ind = porIndicador.get(item.indicador_id); const host = usersById.get(item.anfitriao_id); const property = propertiesById.get(item.property_id); return <li key={item.id} className={`bg-white border rounded-2xl p-4 ${item.status === 'aguardando_aprovacao' ? 'border-amber-300' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-gray-400">Indicado por</p><p className="font-semibold">{ind?.nome || '—'}{ind && !ind.ativo && <span className="text-xs text-red-600 font-medium"> · bloqueado</span>}</p></div><div className="text-right shrink-0"><Badge tone={item.status === 'paga' ? 'success' : ['recusada', 'sem_recompensa'].includes(item.status) ? 'muted' : undefined} warning={['a_pagar', 'aguardando_aprovacao'].includes(item.status)}>{STATUS_ADMIN[item.status]}</Badge>{Number(item.valor_centavos) > 0 && <p className="font-bold mt-1">{cents(item.valor_centavos)}</p>}</div></div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-sm">
        <div><dt className="text-xs text-gray-500">WhatsApp do indicador</dt><dd className="font-medium">{ind?.whatsapp ? <a className="text-primary-600 hover:underline" href={`https://wa.me/55${ind.whatsapp}`} target="_blank" rel="noopener noreferrer">{ind.whatsapp}</a> : '—'}</dd></div>
        <div><dt className="text-xs text-gray-500">Chave Pix e CPF</dt><dd className="font-medium flex items-center gap-2 flex-wrap break-all">{ind?.chave_pix || '—'}<CopyButton value={ind?.chave_pix} label="Copiar Pix"/><span className="text-xs text-gray-400">CPF {ind?.cpf || '—'}</span></dd></div>
        <div><dt className="text-xs text-gray-500">Anfitrião indicado</dt><dd className="font-medium break-words">{host?.name || '—'}<span className="block text-xs text-gray-400 break-all">{host?.email}{host?.phone ? ` · ${host.phone}` : ''}</span></dd></div>
        <div><dt className="text-xs text-gray-500">Espaço</dt><dd className="font-medium">{property ? <button type="button" onClick={() => showProperty(property.id)} className="text-primary-600 hover:underline text-left">{property.name}</button> : 'Ainda não enviado'}</dd></div>
      </dl>
      <p className="text-xs text-gray-400 mt-3">Conta criada {dayBR(item.created_at)}{item.aprovada_em ? ` · aprovado ${dayBR(item.aprovada_em)}` : ''}{item.paga_em ? ` · pago ${dayBR(item.paga_em)}` : ''}{item.verificado_em ? ` · checklist em ${dayBR(item.verificado_em)}` : ''}</p>
      {(item.pagamento_observacao || item.recusa_motivo) && <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 mt-2 break-words">{item.pagamento_observacao || item.recusa_motivo}</p>}
      {['cadastrou', 'aguardando_aprovacao'].includes(item.status) && <ReferralReview property={property} coincidencias={item.coincidencias || []} busy={acting}
        onApprove={(checklist, observacao) => aprovar(item, checklist, observacao)}
        onAdjust={() => ask('reject_property', property.id, property.name)}
        onReject={() => ask('recusar_indicacao', item.id, `Indicação de ${host?.name || 'anfitrião'}`)}/>}
      {['a_pagar', 'paga'].includes(item.status) && <div className="flex flex-wrap gap-2 mt-3">
        {item.status === 'a_pagar' && <button type="button" onClick={() => ask('marcar_indicacao_paga', item.id, `${cents(item.valor_centavos)} para ${ind?.nome || 'indicador'}`, { pix: ind?.chave_pix })} className={primaryBtn}>Marcar como paga</button>}
        <button type="button" onClick={() => ask('invalidar_fraude', item.id, `Indicação de ${host?.name || 'anfitrião'}`)} className={ghostBtn}>Invalidar por fraude</button>
      </div>}
    </li> })}</ul>
    {!lista.length && <Empty>Nenhuma indicação neste filtro.</Empty>}

    {config && <Collapsible title={<span className="flex items-center gap-2"><Settings size={18}/>Configuração do programa</span>} note="Valor, vagas e ligar ou desligar, sem mexer no código."><Configuracao config={config} busy={acting} onSave={(dados, motivo) => onAction({ action: 'configurar_programa', reason: motivo, dados })}/></Collapsible>}

    <Collapsible title="Indicadores" note="Quem tem link. Bloqueie quem fizer envio em massa.">
      <ul className="divide-y divide-gray-100 border-t border-gray-100">{referrers.map(item => { const mine = referrals.filter(ref => ref.indicador_id === item.user_id); return <li key={item.user_id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2"><div className="flex-1 min-w-0"><p className="font-semibold text-sm">{item.nome || usersById.get(item.user_id)?.name || '—'} <span className="text-xs text-gray-400 font-normal">código {item.codigo}</span></p><p className="text-xs text-gray-500">{mine.length} indicação(ões) · {mine.filter(ref => ref.status === 'paga').length} paga(s){item.utm_source ? ` · veio de ${item.utm_source}` : ''}{!item.ativo && item.desativado_motivo ? ` · bloqueado: ${item.desativado_motivo}` : ''}</p></div><Badge tone={item.ativo ? 'success' : 'muted'}>{item.ativo ? 'Link ativo' : 'Bloqueado'}</Badge><button type="button" onClick={() => ask(item.ativo ? 'desativar_indicador' : 'reativar_indicador', item.user_id, item.nome || 'Indicador')} className="text-xs font-semibold text-primary-600 hover:underline py-1.5">{item.ativo ? 'Bloquear link' : 'Reativar link'}</button></li> })}</ul>
      {!referrers.length && <Empty>Ninguém gerou link ainda.</Empty>}
    </Collapsible>
  </div>
}
