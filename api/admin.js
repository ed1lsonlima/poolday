import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const actions = new Set(['approve_property', 'reject_property', 'pause_property', 'suspend_user', 'restore_user', 'verify_user', 'unverify_user', 'resolve_event'])
const referralActions = new Set(['marcar_indicacao_paga', 'recusar_indicacao', 'desativar_indicador', 'reativar_indicador'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isoDay = /^\d{4}-\d{2}-\d{2}$/

// Programa de indicações. Enquanto a migração não for aplicada, o painel continua funcionando sem esta parte.
async function referralData() {
  const [referrers, referrals] = await Promise.all([
    db.from('indicadores').select('user_id,codigo,nome,whatsapp,chave_pix,ativo,desativado_motivo,created_at').order('created_at', { ascending: false }).limit(5000),
    db.from('indicacoes').select('id,indicador_id,anfitriao_id,property_id,status,valor_centavos,created_at,aguardando_em,aprovada_em,paga_em,recusada_em,pagamento_observacao,recusa_motivo').order('created_at', { ascending: false }).limit(5000),
  ])
  for (const result of [referrers, referrals]) {
    if (['42P01', 'PGRST205'].includes(result.error?.code)) return null
    if (result.error) throw result.error
    if (result.data.length === 5000) throw new Error('REPORT_LIMIT')
  }
  return { referrers: referrers.data, referrals: referrals.data }
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
      const { action, id, reason, paidOn } = req.body
      if (!uuid.test(id || '') || typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 500 || (action === 'marcar_indicacao_paga' && !isoDay.test(paidOn || ''))) return res.status(400).json({ error: 'Registro, observação (5 a 500 caracteres) e data válidos são obrigatórios.' })
      const { error } = await db.rpc('admin_indicacao_acao', { p_actor: auth.user.id, p_acao: action, p_id: id, p_texto: reason.trim(), p_pago_em: action === 'marcar_indicacao_paga' ? paidOn : null })
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
      rows('properties', 'id,host_id,name,description,city,state,price_per_day,images,is_active,moderation_status,moderation_note,created_at'),
      rows('bookings', 'id,client_id,host_id,property_id,date,status,total_amount,paid_amount,payment_state,platform_fee,host_amount,promotion_applied,hold_expires_at,created_at,payment_id,cancelled_by,refunded_amount'),
      rows('payment_ledger', '*'), rows('admin_events', '*'), rows('admin_audit', 'id,actor_id,action,entity_id,reason,created_at'),
      referralData(),
    ])
    // Só identificadores e datas: o conteúdo das conversas continua exigindo a consulta registrada.
    const [chatReports, chatModeration, verifications] = await Promise.all([
      rows('booking_chat_reports', 'id,booking_id,created_at'), rows('booking_chat_moderation_events', 'id,booking_id,created_at'), verificationData(),
    ])
    return res.status(200).json({ users, properties, bookings, payments, events, audit, chatReports, chatModeration, verifications, referrers: referral?.referrers ?? null, referrals: referral?.referrals ?? null, generatedAt: new Date().toISOString(), ownerId: auth.user.id })
  } catch (error) {
    console.error('Admin request failed:', error.code || error.message)
    return res.status(500).json({ error: error.message === 'REPORT_LIMIT' ? 'O volume ultrapassou o limite deste relatório. Nenhum total parcial foi exibido. É necessário ampliar a consulta.' : 'Não foi possível carregar o painel. Tente novamente.' })
  }
}
