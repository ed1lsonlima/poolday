import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const actions = new Set(['approve_property', 'reject_property', 'pause_property', 'suspend_user', 'restore_user', 'verify_user', 'unverify_user', 'resolve_event'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

    if (req.method === 'POST') {
      const { action, id, reason } = req.body || {}
      if (!actions.has(action) || !uuid.test(id || '') || typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 1000) return res.status(400).json({ error: 'Ação, registro e motivo válido são obrigatórios.' })
      const { error } = await db.rpc('admin_action', { p_actor: auth.user.id, p_action: action, p_id: id, p_reason: reason.trim() })
      if (error) { console.error('Admin action:', error.code); return res.status(400).json({ error: 'Não foi possível concluir. Verifique o registro, o motivo e se a conta é protegida.' }) }
      return res.status(200).json({ success: true })
    }

    const [users, properties, bookings, payments, events, audit] = await Promise.all([
      rows('profiles', 'id,name,email,phone,city,state,municipality_code,role,verified,suspended,mp_connected,created_at'),
      rows('properties', 'id,host_id,name,description,city,state,price_per_day,images,is_active,moderation_status,moderation_note,created_at'),
      rows('bookings', 'id,client_id,host_id,property_id,date,status,total_amount,paid_amount,payment_state,platform_fee,host_amount,promotion_applied,hold_expires_at,created_at,payment_id'),
      rows('payment_ledger', '*'), rows('admin_events', '*'), rows('admin_audit', 'id,actor_id,action,entity_id,reason,created_at'),
    ])
    return res.status(200).json({ users, properties, bookings, payments, events, audit, generatedAt: new Date().toISOString(), ownerId: auth.user.id })
  } catch (error) {
    console.error('Admin request failed:', error.code || error.message)
    return res.status(500).json({ error: error.message === 'REPORT_LIMIT' ? 'O volume ultrapassou o limite deste relatório. Nenhum total parcial foi exibido. É necessário ampliar a consulta.' : 'Não foi possível carregar o painel. Tente novamente.' })
  }
}

