import test from 'node:test'
import assert from 'node:assert/strict'
import { clearReferralCode, normalizeReferralCode, readReferralClickedAt, readReferralCode, referralLink, saveReferralCode } from '../src/lib/referral.js'
import { cpfValido, formatCpf, linkWhatsApp, maskWhats, mensagemWhatsApp, pixValido, situacao, totaisIndicador, faq, confirmacao } from '../src/lib/referralProgram.js'
import { coincidencias, contadoresPrograma, cpfsRepetidos } from '../src/lib/referralAdmin.js'

function fakeBrowser() {
  const data = new Map()
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }
  const doc = { _c: '', get cookie() { return this._c }, set cookie(v) { this._c = /Max-Age=0/.test(v) ? '' : v.split(';')[0] } }
  return { storage, doc }
}

test('código: só o formato gerado pelo banco, sempre em maiúsculas', () => {
  assert.equal(normalizeReferralCode(' ana4k2q '), 'ANA4K2Q')
  assert.equal(normalizeReferralCode('abc'), null)
  assert.equal(normalizeReferralCode('<script>'), null)
  assert.equal(normalizeReferralCode('A'.repeat(13)), null)
})

test('código: guardado por 60 dias, com a data do clique', () => {
  const b = fakeBrowser(); const now = Date.UTC(2026, 10, 21)
  assert.equal(saveReferralCode('ana4k2q', { ...b, now }), 'ANA4K2Q')
  assert.equal(readReferralCode({ ...b, now: now + 59 * 864e5 }), 'ANA4K2Q')
  assert.equal(readReferralClickedAt({ ...b, now }), new Date(now).toISOString())
  b.doc._c = ''
  assert.equal(readReferralCode({ ...b, now: now + 61 * 864e5 }), null)
})

test('código: vale o primeiro link clicado', () => {
  const b = fakeBrowser(); const now = Date.UTC(2026, 10, 21)
  saveReferralCode('PRIMEIRO1', { ...b, now })
  assert.equal(saveReferralCode('SEGUNDO22', { ...b, now: now + 1000 }), 'PRIMEIRO1')
  assert.equal(readReferralCode({ ...b, now }), 'PRIMEIRO1')
  clearReferralCode(b)
  assert.equal(readReferralCode({ ...b, now }), null)
})

test('link de indicação leva para a página do anfitrião com ?ref', () => {
  assert.equal(referralLink('https://www.pooldaybr.com', 'ANA4K2Q'), 'https://www.pooldaybr.com/seja-anfitriao?ref=ANA4K2Q')
})

test('CPF e Pix: conferência na tela', () => {
  assert.equal(cpfValido('529.982.247-25'), true)
  assert.equal(cpfValido('111.111.111-11'), false)
  assert.equal(cpfValido('529.982.247-24'), false)
  assert.equal(formatCpf('52998224725'), '529.982.247-25')
  assert.equal(maskWhats('5582999991234'), '(82) 99999-1234')
  for (const ok of ['529.982.247-25', 'ana@x.com', '(82) 99999-1234', '123e4567-e89b-12d3-a456-426614174000', '11.222.333/0001-81']) assert.equal(pixValido(ok), true, ok)
  for (const ruim of ['', 'qualquer coisa', '123']) assert.equal(pixValido(ruim), false, ruim)
})

test('textos: o valor nunca aparece sem a condição de aprovação', () => {
  assert.match(confirmacao(3000), /R\$\s?30.*cadastrado completo e aprovado.*Só indicar ou só criar a conta não gera pagamento/)
  for (const [pergunta, resposta] of faq({ valor_centavos: 3000 })) if (/R\$/.test(resposta)) assert.match(resposta, /aprovad/, pergunta)
  assert.match(mensagemWhatsApp('https://x'), /cadastro é grátis.*https:\/\/x$/)
  assert.match(linkWhatsApp('https://x'), /^https:\/\/wa\.me\/\?text=/)
})

test('painel do indicador: status em linguagem simples, dizendo se tem dinheiro', () => {
  assert.match(situacao({ status: 'cadastrou' }).texto, /ainda sem valor/)
  assert.match(situacao({ status: 'aguardando_aprovacao' }).texto, /ainda sem valor/)
  assert.match(situacao({ status: 'a_pagar', valor_centavos: 3000 }).texto, /Aprovado: R\$\s?30, Pix em até 7 dias/)
  assert.equal(situacao({ status: 'paga' }).texto, 'Pago')
  assert.match(situacao({ status: 'recusada', motivo: 'Autoindicação' }).texto, /^Não aprovado: Autoindicação/)
  assert.equal(situacao({ status: 'recusada' }).etapa, -1)
  assert.deepEqual(totaisIndicador([{ status: 'a_pagar', valor_centavos: 3000 }, { status: 'paga', valor_centavos: 3000 }, { status: 'cadastrou', valor_centavos: 0 }]), { aReceber: 3000, pago: 3000 })
})

test('Adm: encontra autoindicação e conta as vagas', () => {
  const indicador = { user_id: 'a', cpf: '52998224725', email: 'ana@x.com', whatsapp: '82999991234', chave_pix: 'ana@x.com' }
  assert.deepEqual(coincidencias(indicador, { id: 'b', email: 'ANA@x.com', phone: '+55 (82) 99999-1234' }, '52998224725'), ['mesmo CPF', 'mesmo e-mail', 'mesmo WhatsApp'])
  assert.deepEqual(coincidencias(indicador, { id: 'b', email: 'joao@x.com', phone: '82988887777' }, '11144477735'), [])
  const c = contadoresPrograma({ referrers: [indicador], config: { vagas: 20 }, referrals: [{ status: 'a_pagar', valor_centavos: 3000 }, { status: 'paga', valor_centavos: 3000 }, { status: 'sem_recompensa', valor_centavos: 0 }, { status: 'aguardando_aprovacao' }] })
  assert.deepEqual([c.links, c.contas, c.emAnalise, c.aprovados, c.vagasRestantes, c.aPagar, c.pago], [1, 4, 1, 2, 18, 3000, 3000])
  assert.equal(cpfsRepetidos([{ cpf: '1' }, { cpf: '1' }, { cpf: '2' }]).length, 1)
})
