import { createClient } from '@supabase/supabase-js'
import { requireUser } from './_lib/auth.js'
import { CHAT_NOTICE_VERSION, bookingChatWritable, externalContactReason } from '../src/lib/chatSafety.js'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sendError(res, status, error) { return res.status(status).json({ error }) }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  res.setHeader('Vary', 'Authorization')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (!['GET', 'POST'].includes(req.method)) return sendError(res, 405, 'Método não permitido.')
  const user = await requireUser(req, res, db)
  if (!user) return
  const bookingId = req.method === 'GET' ? req.query?.bookingId : req.body?.bookingId
  if (!uuid.test(bookingId || '')) return sendError(res, 400, 'Reserva inválida.')
  try {
    const { data: booking, error: bookingError } = await db.from('bookings')
      .select('id,client_id,host_id,status,payment_state,paid_amount,cancelled_at,host_presence,date,property_id')
      .eq('id', bookingId).maybeSingle()
    if (bookingError) throw bookingError
    if (!booking || ![booking.client_id, booking.host_id].includes(user.id)) return sendError(res, 403, 'Esta conversa não pertence à sua reserva.')
    const role = user.id === booking.client_id ? 'client' : 'host'
    const partnerId = role === 'client' ? booking.host_id : booking.client_id
    const { data: accepted, error: acceptanceError } = await db.from('booking_chat_acceptances')
      .select('notice_version,accepted_at').eq('booking_id', bookingId).eq('user_id', user.id).maybeSingle()
    if (acceptanceError) throw acceptanceError
    const hasAccepted = accepted?.notice_version === CHAT_NOTICE_VERSION
    const canWrite = bookingChatWritable(booking)

    if (req.method === 'GET') {
      if (!hasAccepted) return res.status(200).json({ role, accepted: false, canWrite, bookingDate: booking.date, messages: [], noticeVersion: CHAT_NOTICE_VERSION })
      const before = req.query?.before
      if (before && Number.isNaN(Date.parse(before))) return sendError(res, 400, 'Página inválida.')
      let query = db.from('messages').select('id,sender_id,content,created_at,read')
        .eq('booking_id', bookingId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50)
      if (before) query = query.lt('created_at', before)
      const { data: messages, error } = await query
      if (error) throw error
      if (messages?.some(message => message.sender_id === partnerId && !message.read)) {
        await db.from('messages').update({ read: true }).eq('booking_id', bookingId).eq('receiver_id', user.id).eq('read', false)
      }
      return res.status(200).json({ role, accepted: true, canWrite, bookingDate: booking.date, messages: (messages || []).reverse(), hasMore: messages?.length === 50, noticeVersion: CHAT_NOTICE_VERSION })
    }

    const action = req.body?.action
    if (action === 'accept') {
      if (!canWrite) return sendError(res, 403, 'O chat abre somente após o pagamento confirmado de uma reserva ativa.')
      if (req.body?.noticeVersion !== CHAT_NOTICE_VERSION) return sendError(res, 409, 'Leia a versão atual do aviso antes de continuar.')
      const { error } = await db.from('booking_chat_acceptances').upsert({ booking_id: bookingId, user_id: user.id, role, notice_version: CHAT_NOTICE_VERSION, accepted_at: new Date().toISOString() }, { onConflict: 'booking_id,user_id' })
      if (error) throw error
      return res.status(200).json({ accepted: true })
    }
    if (!hasAccepted) return sendError(res, 403, 'Leia e aceite o aviso antes de usar o chat.')
    if (action === 'report') {
      const reason = String(req.body?.reason || '').trim()
      if (reason.length < 8 || reason.length > 500) return sendError(res, 400, 'Descreva o problema em 8 a 500 caracteres.')
      const { error } = await db.from('booking_chat_reports').insert({ booking_id: bookingId, reporter_id: user.id, reason })
      if (error) throw error
      await db.from('admin_events').insert({ kind: 'chat_report', severity: 'review', title: 'Conversa denunciada', detail: reason.slice(0, 200), entity_id: bookingId })
      return res.status(200).json({ reported: true })
    }
    if (action !== 'send') return sendError(res, 400, 'Ação inválida.')
    if (!canWrite) return sendError(res, 403, 'Esta conversa está disponível apenas para consulta.')
    const content = String(req.body?.content || '').trim()
    if (!content || content.length > 1000) return sendError(res, 400, 'Escreva uma mensagem de até 1000 caracteres.')
    const urgent = req.body?.urgent === true && booking.date === new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Maceio' })
    const blockedReason = externalContactReason(content)
    if (blockedReason) {
      await db.from('booking_chat_moderation_events').insert({ booking_id: bookingId, sender_id: user.id, kind: blockedReason, content })
      await db.from('admin_events').insert({ kind: 'chat_contact', severity: 'review', title: 'Possível contato externo no chat', detail: `Motivo: ${blockedReason}`, entity_id: bookingId })
      return sendError(res, 422, 'A mensagem parece conter contato externo. Retire telefone, rede social, link ou convite para negociar por fora.')
    }
    const minuteAgo = new Date(Date.now() - 60000).toISOString()
    const { count, error: limitError } = await db.from('messages').select('id', { count: 'exact', head: true })
      .eq('booking_id', bookingId).eq('sender_id', user.id).gte('created_at', minuteAgo)
    if (limitError) throw limitError
    if (count >= 10) return sendError(res, 429, 'Aguarde um minuto antes de enviar mais mensagens.')
    const { data: message, error } = await db.from('messages').insert({ booking_id: bookingId, sender_id: user.id, receiver_id: partnerId, content }).select('id,sender_id,content,created_at,read').single()
    if (error) throw error
    await db.from('notifications').insert({ event_key: `chat:${message.id}`, user_id: partnerId, booking_id: bookingId, kind: urgent ? 'chat_urgent' : 'chat', title: urgent ? 'Ajuda urgente na reserva de hoje' : 'Nova mensagem sobre sua reserva', message: 'Abra a conversa no PoolDay para responder.', action_url: `/reserva/${bookingId}/chat` })
    return res.status(200).json({ message })
  } catch (error) {
    console.error('Booking chat:', error.code || error.message)
    return sendError(res, 500, 'Não foi possível atualizar a conversa. Tente novamente.')
  }
}

