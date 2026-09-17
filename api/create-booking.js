import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function bearerToken(req) {
  const value = req.headers.authorization || '';
  return typeof value === 'string' ? /^Bearer ([^\s]+)$/i.exec(value)?.[1] : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: 'Faça login para reservar.' });

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) return res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' });

    const { propertyId, date } = req.body || {};
    if (typeof propertyId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId) || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) {
      return res.status(400).json({ error: 'Espaço e data são obrigatórios.' });
    }

    const { data: profile, error: profileError } = await supabase.from('profiles').select('suspended').eq('id', authData.user.id).single();
    if (profileError) throw profileError;
    if (profile.suspended) return res.status(403).json({ error: 'Sua conta está em análise. Entre em contato com o suporte.' });

    const { data, error } = await supabase.rpc('create_booking_hold', {
      p_property_id: propertyId,
      p_client_id: authData.user.id,
      p_date: date,
      p_guests: null,
    });

    if (error) {
      const message = error.message || '';
      if (message.includes('DATA_INDISPONIVEL')) return res.status(409).json({ error: 'data_indisponivel', message: 'Essa data acabou de ser reservada. Escolha outra.' });
      if (message.includes('ESPACO_INDISPONIVEL')) return res.status(400).json({ error: 'espaco_indisponivel', message: 'Este espaço não está disponível.' });
      throw error;
    }

    const booking = Array.isArray(data) ? data[0] : data;
    if (!booking?.booking_id) throw new Error('EMPTY_BOOKING');
    return res.status(200).json({ bookingId: booking?.booking_id, holdExpiresAt: booking?.hold_expires_at });
  } catch (error) {
    console.error('Erro ao criar reserva temporária:', error.code || error.message);
    return res.status(500).json({ error: 'Erro ao iniciar a reserva.' });
  }
}
