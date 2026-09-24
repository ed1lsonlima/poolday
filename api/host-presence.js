import { createClient } from '@supabase/supabase-js'
import { requireUser } from './_lib/auth.js'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const validPresence = new Set(['host', 'representative', 'self_checkin'])
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido.' })
  const propertyId = req.method === 'GET' ? req.query?.propertyId : req.body?.propertyId
  const date = req.method === 'GET' ? req.query?.date : req.body?.date
  if (!uuid.test(propertyId || '') || (date && !validDate(date))) return res.status(400).json({ error: 'Espaço ou data inválida.' })
  try {
    const { data: property, error: propertyError } = await db.from('properties').select('id,host_id,host_presence,is_active,moderation_status').eq('id', propertyId).maybeSingle()
    if (propertyError) throw propertyError
    if (!property) return res.status(404).json({ error: 'Espaço não encontrado.' })
    if (req.method === 'GET') {
      if (req.query?.manage === '1') {
        const user = await requireUser(req, res, db)
        if (!user) return
        if (user.id !== property.host_id) return res.status(403).json({ error: 'Acesso restrito ao anfitrião.' })
        const { data: overrides, error } = await db.from('property_presence_overrides').select('date,presence').eq('property_id', propertyId).gte('date', new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Maceio' }))
        if (error) throw error
        return res.status(200).json({ presence: property.host_presence, overrides: overrides || [] })
      }
      if (!property.is_active || property.moderation_status !== 'approved') return res.status(404).json({ error: 'Espaço indisponível.' })
      if (!date) return res.status(200).json({ presence: property.host_presence })
      const { data: override, error } = await db.from('property_presence_overrides').select('presence').eq('property_id', propertyId).eq('date', date).maybeSingle()
      if (error) throw error
      return res.status(200).json({ presence: override?.presence || property.host_presence })
    }
    const user = await requireUser(req, res, db)
    if (!user) return
    if (user.id !== property.host_id) return res.status(403).json({ error: 'Somente o anfitrião pode ajustar a recepção.' })
    if (!validDate(date) || date < new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Maceio' })) return res.status(400).json({ error: 'Selecione uma data futura válida.' })
    const presence = req.body?.presence
    if (presence !== null && !validPresence.has(presence)) return res.status(400).json({ error: 'Escolha como o cliente será recebido.' })
    const { data: bookings, error: bookingError } = await db.from('bookings').select('id,status,hold_expires_at').eq('property_id', propertyId).eq('date', date).in('status', ['pending','confirmed'])
    if (bookingError) throw bookingError
    if (bookings?.some(booking => booking.status === 'confirmed' || !booking.hold_expires_at || new Date(booking.hold_expires_at) > new Date())) return res.status(409).json({ error: 'Essa data já tem reserva ou bloqueio de pagamento. Não é possível alterar a recepção agora.' })
    const result = presence === null
      ? await db.from('property_presence_overrides').delete().eq('property_id', propertyId).eq('date', date)
      : await db.from('property_presence_overrides').upsert({ property_id: propertyId, date, presence, updated_at: new Date().toISOString() }, { onConflict: 'property_id,date' })
    if (result.error) throw result.error
    return res.status(200).json({ presence: presence || property.host_presence })
  } catch (error) {
    console.error('Host presence:', error.code || error.message)
    return res.status(500).json({ error: 'Não foi possível atualizar a recepção.' })
  }
}

