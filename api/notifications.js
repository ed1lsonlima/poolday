import { createClient } from '@supabase/supabase-js'
import { requireUser } from './_lib/auth.js'

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const user = await requireUser(req, res, db)
    if (!user) return
    const { id, action } = req.body || {}
    if (action !== 'delete' || typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ error: 'Notificação inválida.' })
    const { error } = await db.from('notifications').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    return res.status(200).json({ deleted: true })
  } catch {
    return res.status(500).json({ error: 'Não foi possível excluir a notificação.' })
  }
}

