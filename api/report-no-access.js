import { createClient } from '@supabase/supabase-js'
import { requireUser } from './_lib/auth.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ERRORS = [
  ['FORBIDDEN', 403, 'Você não pode registrar este aviso.'],
  ['RESERVA_NAO_ENCONTRADA', 404, 'Reserva não encontrada.'],
  ['RESERVA_NAO_CONFIRMADA', 409, 'Só é possível avisar em uma reserva confirmada.'],
  ['FORA_DO_PRAZO', 409, 'Este aviso vale no dia da diária e até 12h do dia seguinte. Fale com o suporte PoolDay.'],
]

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  try {
    const user = await requireUser(req, res, supabase)
    if (!user) return
    const { bookingId } = req.body || {}
    if (typeof bookingId !== 'string' || !UUID.test(bookingId)) return res.status(400).json({ error: 'Reserva inválida.' })

    const { data, error } = await supabase.rpc('report_no_access', { p_booking_id: bookingId, p_actor: user.id })
    if (error) {
      const known = ERRORS.find(([code]) => (error.message || '').includes(code))
      if (known) return res.status(known[1]).json({ error: known[2] })
      throw error
    }
    return res.status(200).json({ success: true, reportedAt: data })
  } catch (error) {
    console.error('Erro ao registrar falta de acesso:', error.code || error.message)
    return res.status(500).json({ error: 'Não foi possível registrar o aviso. Fale com o suporte PoolDay.' })
  }
}
