import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

function bearerToken(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: 'Faça login para reservar.' });

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) return res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' });

    const { propertyId, date, guests } = req.body || {};
    if (!propertyId || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      return res.status(400).json({ error: 'Espaço e data são obrigatórios.' });
    }

    const guestCount = Number(guests);
    if (!Number.isInteger(guestCount) || guestCount < 1) {
      return res.status(400).json({ error: 'Quantidade de convidados inválida.' });
    }

    const { data, error } = await supabase.rpc('create_booking_hold', {
      p_property_id: propertyId,
      p_client_id: authData.user.id,
      p_date: date,
      p_guests: guestCount,
    });

    if (error) {
      const message = error.message || '';
      if (message.includes('DATA_INDISPONIVEL')) return res.status(409).json({ error: 'data_indisponivel', message: 'Essa data acabou de ser reservada. Escolha outra.' });
      if (message.includes('CAPACIDADE_EXCEDIDA')) return res.status(400).json({ error: 'capacidade_excedida', message: 'A quantidade de convidados supera a capacidade do espaço.' });
      if (message.includes('ESPACO_INDISPONIVEL')) return res.status(400).json({ error: 'espaco_indisponivel', message: 'Este espaço não está disponível.' });
      throw error;
    }

    const booking = Array.isArray(data) ? data[0] : data;
    return res.status(200).json({ bookingId: booking?.booking_id, holdExpiresAt: booking?.hold_expires_at });
  } catch (error) {
    console.error('Erro ao criar reserva temporária:', error);
    return res.status(500).json({ error: 'Erro ao iniciar a reserva.' });
  }
}

