import { createClient } from '@supabase/supabase-js'
import { coincidencias } from '../src/lib/referralAdmin.js'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const actions = new Set(['approve_property', 'reject_property', 'pause_property', 'suspend_user', 'restore_user', 'verify_user', 'unverify_user', 'resolve_event'])
const referralActions = new Set(['marcar_indicacao_paga', 'recusar_indicacao', 'desativar_indicador', 'reativar_indicador', 'invalidar_fraude', 'configurar_programa', 'aprovar_indicado'])
const CHECKLIST_KEYS = ['anuncio_completo', 'fotos_originais', 'endereco_confere', 'dono_confirmou', 'video_recebido', 'pessoas_diferentes']
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isoDay = /^\d{4}-\d{2}-\d{2}$/

// Programa de indicações. Enquanto a migração não for aplicada, o painel continua funcionando sem esta parte.
async function referralData() {
  const [referrers, referrals] = await Promise.all([
    db.from('indicadores').select('user_id,codigo,nome,whatsapp,chave_pix,cpf,email,ativo,desativado_motivo,aceite_regras_em,utm_source,utm_medium,utm_campaign,created_at').order('created_at', { ascending: false }).limit(5000),
    db.from('indicacoes').select('id,indicador_id,anfitriao_id,property_id,status,valor_centavos,created_at,clicado_em,aguardando_em,aprovada_em,paga_em,recusada_em,pagamento_observacao,recusa_motivo,verificacao,verificado_em').order('created_at', { ascending: false }).limit(5000),
  ])
  for (const result of [referrers, referrals]) {
    if (['42P01', 'PGRST205'].includes(result.error?.code)) return null
    if (result.error) throw result.error
    if (result.data.length === 5000) throw new Error('REPORT_LIMIT')
  }
  const [config, documentos] = await Promise.all([
    db.from('programa_indicacao').select('ativo,valor_centavos,vagas,tolerancia_dias,encerrado_em').maybeSingle(),
    db.from('documentos_anfitriao').select('user_id,cpf').in('user_id', referrals.data.map(item => item.anfitriao_id).concat('00000000-0000-0000-0000-000000000000')),
  ])
  for (const result of [config, documentos]) if (result.error && !['42P01', 'PGRST205'].includes(result.error.code)) throw result.error
  return { referrers: referrers.data, referrals: referrals.data, config: config.data || null, cpfs: new Map((documentos.data || []).map(item => [item.user_id, item.cpf])) }
}

// Enquanto a migração não rodar, o painel continua abrindo, apenas sem os prazos.
async function verificationData() {
  const { data, error } = await db.from('host_verifications').select('host_id,due_at').limit(10000)
  if (['42P01', 'PGRST205'].includes(error?.code)) return []
  if (error) throw error
  return data
}

async function rows(table, columns, limit = 10000) {
  const result = []
  for (let offset = 0; offset < limit; offset += 1000) {
    const { data, error } = await db.from(table).select(columns).order('created_at', { ascending: false }).order(table === 'payment_ledger' ? 'payment_id' : 'id').range(offset, offset + 999)
    if (error) throw error
    result.push(...data)
    if (data.length < 1000) return result
  }
  throw new Error('REPORT_LIMIT') // Never present a silently truncated financial total.
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  res.setHeader('Vary', 'Authorization')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido' })
  try {
    const token = typeof req.headers.authorization === 'string' ? /^Bearer ([^\s]+)$/i.exec(req.headers.authorization)?.[1] : null
    if (!token) return res.status(401).json({ error: 'Entre na sua conta.' })
    const { data: auth, error: authError } = await db.auth.getUser(token)
    if (authError || !auth.user) return res.status(401).json({ error: 'Sessão expirada.' })
    const { data: member, error: memberError } = await db.from('admin_members').select('user_id').eq('user_id', auth.user.id).maybeSingle()
    if (memberError) throw memberError
    if (!member) return res.status(403).json({ error: 'Acesso exclusivo da administração.' })
    if (req.method === 'GET' && req.query?.action === 'access') return res.status(200).json({ isAdmin: true })
    const { data: verified, error: claimError } = await db.auth.getClaims(token)
    if (claimError || verified?.claims?.sub !== auth.user.id || verified?.claims?.aal !== 'aal2') return res.status(403).json({ error: 'Confirme seu código de segurança.', code: 'MFA_REQUIRED' })
    if (!uuid.test(verified.claims.session_id || '')) return res.status(401).json({ error: 'Entre novamente para acessar a administração.' })
    const { data: activeSession, error: sessionError } = await db.rpc('admin_session_valid', { p_user_id: auth.user.id, p_session_id: verified.claims.session_id })
    if (sessionError) throw sessionError
    if (!activeSession) return res.status(403).json({ error: 'Confirme novamente seu código de segurança.', code: 'MFA_REQUIRED' })

    if (req.method === 'GET' && req.query?.action === 'chat-detail') {
      const bookingId = req.query?.bookingId
      if (!uuid.test(bookingId || '')) return res.status(400).json({ error: 'Reserva inválida.' })
      const [bookingResult, messagesResult, reportsResult, moderationResult, acceptanceResult] = await Promise.all([
        db.from('bookings').select('id,client_id,host_id,property_id,date,status,paid_amount').eq('id', bookingId).maybeSingle(),
        db.from('messages').select('id,sender_id,content,created_at').eq('booking_id', bookingId).order('created_at', { ascending: false }).limit(500),
        db.from('booking_chat_reports').select('id,reporter_id,reason,created_at').eq('booking_id', bookingId).order('created_at', { ascending: false }).limit(50),
        db.from('booking_chat_moderation_events').select('id,sender_id,kind,content,created_at').eq('booking_id', bookingId).order('created_at', { ascending: false }).limit(100),
        db.from('booking_chat_acceptances').select('user_id,role,notice_version,accepted_at').eq('booking_id', bookingId),
      ])
      for (const result of [bookingResult, messagesResult, reportsResult, moderationResult, acceptanceResult]) if (result.error) throw result.error
      if (!bookingResult.data) return res.status(404).json({ error: 'Reserva não encontrada.' })
      const { error: auditError } = await db.from('admin_audit').insert({ actor_id: auth.user.id, action: 'view_booking_chat', entity_id: bookingId, reason: 'Consulta da conversa no painel de administração.' })
      if (auditError) throw auditError
      return res.status(200).json({ booking: bookingResult.data, messages: (messagesResult.data || []).reverse(), reports: reportsResult.data || [], moderation: moderationResult.data || [], acceptances: acceptanceResult.data || [], hasMore: messagesResult.data?.length === 500 })
    }

    if (req.method === 'GET' && req.query?.action === 'property-detail') {
      const propertyId = req.query?.propertyId
      if (!uuid.test(propertyId || '')) return res.status(400).json({ error: 'Espaço inválido.' })
      const { data: property, error: propertyError } = await db.from('properties').select('*').eq('id', propertyId).maybeSingle()
      if (propertyError) throw propertyError
      if (!property) return res.status(404).json({ error: 'Espaço não encontrado.' })
      const { error: auditError } = await db.from('admin_audit').insert({ actor_id: auth.user.id, action: 'view_property', entity_id: propertyId, reason: 'Revisão completa do anúncio antes da moderação.' })
      if (auditError) throw auditError
      return res.status(200).json({ property })
    }

    if (req.method === 'POST' && referralActions.has(req.body?.action)) {
      const { action, id, reason, paidOn, dados, checklist } = req.body
      if ((action !== 'configurar_programa' && !uuid.test(id || '')) || typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500 || (action === 'marcar_indicacao_paga' && !isoDay.test(paidOn || ''))) return res.status(400).json({ error: 'Registro, observação (5 a 500 caracteres) e data válidos são obrigatórios.' })
      if (action === 'aprovar_indicado') {
        // Aprovação de espaço indicado: só com a checklist completa. A recompensa é liberada pelo banco.
        if (!checklist || CHECKLIST_KEYS.some(key => checklist[key] !== true)) return res.status(400).json({ error: 'Marque todos os itens da checklist antes de aprovar.' })
        const { data: indicacao, error: readError } = await db.from('indicacoes').select('id,property_id,status').eq('id', id).maybeSingle()
        if (readError) throw readError
        if (!indicacao?.property_id || !['cadastrou', 'aguardando_aprovacao'].includes(indicacao.status)) return res.status(400).json({ error: 'Esta indicação não tem espaço aguardando aprovação.' })
        const verificacao = await db.rpc('admin_indicacao_acao', { p_actor: auth.user.id, p_acao: 'registrar_verificacao', p_id: id, p_texto: reason.trim(), p_pago_em: null, p_dados: Object.fromEntries(CHECKLIST_KEYS.map(key => [key, true])) })
        if (verificacao.error) { console.error('Referral checklist:', verificacao.error.code); return res.status(400).json({ error: 'Não foi possível registrar a checklist.' }) }
        const aprovacao = await db.rpc('admin_action', { p_actor: auth.user.id, p_action: 'approve_property', p_id: indicacao.property_id, p_reason: `Aprovado com checklist de indicação: ${reason.trim()}` })
        if (aprovacao.error) { console.error('Referral approve:', aprovacao.error.code); return res.status(400).json({ error: 'Checklist salva, mas não foi possível aprovar o espaço.' }) }
        return res.status(200).json({ success: true })
      }
      if (action === 'configurar_programa' && (!dados || typeof dados !== 'object')) return res.status(400).json({ error: 'Configuração inválida.' })
      const { error } = await db.rpc('admin_indicacao_acao', { p_actor: auth.user.id, p_acao: action, p_id: action === 'configurar_programa' ? null : id, p_texto: reason.trim(), p_pago_em: action === 'marcar_indicacao_paga' ? paidOn : null, p_dados: action === 'configurar_programa' ? { valor_centavos: Number(dados.valor_centavos), vagas: Number(dados.vagas), ativo: Boolean(dados.ativo) } : null })
      if (error) { console.error('Referral action:', error.code); return res.status(400).json({ error: 'Não foi possível concluir. Confira se a indicação está a pagar e se a data não é futura.' }) }
      return res.status(200).json({ success: true })
    }

    if (req.method === 'POST') {
      const { action, id, reason } = req.body || {}
      const approval = action === 'approve_property'
      if (!actions.has(action) || !uuid.test(id || '') || (!approval && (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 1000))) return res.status(400).json({ error: 'Ação, registro e motivo válido são obrigatórios.' })
      const resolvedReason = approval ? 'Aprovado após revisão do anúncio.' : reason.trim()
      const { error } = await db.rpc('admin_action', { p_actor: auth.user.id, p_action: action, p_id: id, p_reason: resolvedReason })
      if (error) { console.error('Admin action:', error.code); return res.status(400).json({ error: 'Não foi possível concluir. Verifique o registro, o motivo e se a conta é protegida.' }) }
      return res.status(200).json({ success: true })
    }

    const [users, properties, bookings, payments, events, audit, referral] = await Promise.all([
      rows('profiles', 'id,name,email,phone,city,state,municipality_code,role,verified,suspended,mp_connected,created_at'),
      rows('properties', 'id,host_id,name,description,address,city,state,price_per_day,images,is_active,moderation_status,moderation_note,created_at'),
      rows('bookings', 'id,client_id,host_id,property_id,date,status,total_amount,paid_amount,payment_state,platform_fee,host_amount,promotion_applied,hold_expires_at,created_at,payment_id,cancelled_by,refunded_amount'),
      rows('payment_ledger', '*'), rows('admin_events', '*'), rows('admin_audit', 'id,actor_id,action,entity_id,reason,created_at'),
      referralData(),
    ])
    // Só identificadores e datas: o conteúdo das conversas continua exigindo a consulta registrada.
    const [chatReports, chatModeration, verifications] = await Promise.all([
      rows('booking_chat_reports', 'id,booking_id,created_at'), rows('booking_chat_moderation_events', 'id,booking_id,created_at'), verificationData(),
    ])
    return res.status(200).json({ users, properties, bookings, payments, events, audit, chatReports, chatModeration, verifications, referrers: referral?.referrers ?? null, referralConfig: referral?.config ?? null,
      referrals: referral ? referral.referrals.map(item => ({ ...item, coincidencias: coincidencias(referral.referrers.find(r => r.user_id === item.indicador_id), users.find(u => u.id === item.anfitriao_id), referral.cpfs.get(item.anfitriao_id)) })) : null, generatedAt: new Date().toISOString(), ownerId: auth.user.id })
  } catch (error) {
    console.error('Admin request failed:', error.code || error.message)
    return res.status(500).json({ error: error.message === 'REPORT_LIMIT' ? 'O volume ultrapassou o limite deste relatório. Nenhum total parcial foi exibido. É necessário ampliar a consulta.' : 'Não foi possível carregar o painel. Tente novamente.' })
  }
}
