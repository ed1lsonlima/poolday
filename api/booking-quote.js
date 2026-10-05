import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  const propertyId = req.query?.propertyId;
  if (typeof propertyId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId)) {
    return res.status(400).json({ error: 'Espaço inválido.' });
  }
  try {
    const { data, error } = await supabase.rpc('quote_booking_v2', { p_property_id: propertyId });
    if (error) {
      if ((error.message || '').includes('ESPACO_INDISPONIVEL')) return res.status(404).json({ error: 'Espaço indisponível.' });
      throw error;
    }
    const quote = Array.isArray(data) ? data[0] : data;
    if (!quote) return res.status(404).json({ error: 'Espaço indisponível.' });
    return res.status(200).json({
      listedPrice: Number(quote.listed_price),
      guestServiceFee: Number(quote.guest_service_fee),
      totalAmount: Number(quote.total_amount),
    });
  } catch (error) {
    console.error('Erro ao consultar preço:', error.code || error.message);
    return res.status(500).json({ error: 'Não foi possível consultar o preço.' });
  }
}

