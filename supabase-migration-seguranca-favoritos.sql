-- ============================================================
-- PoolDay — Migração de SEGURANÇA + FAVORITOS (julho/2026)
-- Cole este SQL inteiro no Supabase > SQL Editor > Run
-- Pode rodar mais de uma vez sem quebrar (idempotente).
-- ============================================================

-- 1. TABELA PRIVADA DE CREDENCIAIS DO MERCADO PAGO
-- Problema corrigido: os tokens estavam em "profiles", que tem leitura
-- pública (SELECT USING true). Qualquer pessoa podia roubar o access_token
-- de todos os anfitriões. Agora ficam numa tabela SEM policies de leitura:
-- só a service role (o backend) enxerga.
CREATE TABLE IF NOT EXISTS mp_credentials (
  host_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  mp_user_id TEXT,
  mp_access_token TEXT,
  mp_refresh_token TEXT,
  mp_public_key TEXT,
  mp_token_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE mp_credentials ENABLE ROW LEVEL SECURITY;
-- (nenhuma policy criada de propósito: acesso zero pra anon/authenticated)

-- Flag pública inofensiva pro dashboard
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mp_connected BOOLEAN DEFAULT FALSE;

-- Migra tokens que já existirem em profiles pra tabela privada e apaga as colunas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'profiles' AND column_name = 'mp_access_token') THEN
    INSERT INTO mp_credentials (host_id, mp_user_id, mp_access_token, mp_refresh_token, mp_public_key, mp_token_expires_at)
    SELECT id, mp_user_id, mp_access_token, mp_refresh_token, mp_public_key, mp_token_expires_at
    FROM profiles WHERE mp_access_token IS NOT NULL
    ON CONFLICT (host_id) DO NOTHING;

    UPDATE profiles SET mp_connected = TRUE WHERE mp_access_token IS NOT NULL;

    ALTER TABLE profiles DROP COLUMN IF EXISTS mp_access_token;
    ALTER TABLE profiles DROP COLUMN IF EXISTS mp_refresh_token;
    ALTER TABLE profiles DROP COLUMN IF EXISTS mp_public_key;
    ALTER TABLE profiles DROP COLUMN IF EXISTS mp_token_expires_at;
    ALTER TABLE profiles DROP COLUMN IF EXISTS mp_user_id;
  END IF;
END $$;

-- 2. RESERVAS: cliente não pode mais "se auto-confirmar"
-- Problema corrigido: a policy antiga deixava o cliente dar UPDATE em
-- qualquer campo (ex.: status = 'confirmed' sem pagar, ou mudar o valor).
DROP POLICY IF EXISTS "Atualizar status da reserva" ON bookings;
DROP POLICY IF EXISTS "Anfitriao atualiza reserva" ON bookings;
DROP POLICY IF EXISTS "Cliente cancela reserva" ON bookings;

CREATE POLICY "Anfitriao atualiza reserva" ON bookings
  FOR UPDATE USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id AND status IN ('confirmed','cancelled','completed'));

CREATE POLICY "Cliente cancela reserva" ON bookings
  FOR UPDATE USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id AND status = 'cancelled');

-- 3. Anti double-booking: nunca pode haver duas reservas CONFIRMADAS
-- pro mesmo espaço na mesma data (proteção no banco, não só no front).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_confirmed_booking
  ON bookings (property_id, date) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_bookings_property_date ON bookings (property_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings (client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_host ON bookings (host_id);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties (city);

-- 4. FAVORITOS (o coração agora salva de verdade)
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, property_id)
);
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver proprios favoritos" ON favorites;
DROP POLICY IF EXISTS "Criar favorito" ON favorites;
DROP POLICY IF EXISTS "Remover favorito" ON favorites;
CREATE POLICY "Ver proprios favoritos" ON favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Criar favorito" ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Remover favorito" ON favorites FOR DELETE USING (auth.uid() = user_id);

-- 5. AVALIAÇÕES: uma por reserva, e só de quem realmente reservou
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_booking_unique;
ALTER TABLE reviews ADD CONSTRAINT reviews_booking_unique UNIQUE (booking_id);

DROP POLICY IF EXISTS "Criar avaliação" ON reviews;
DROP POLICY IF EXISTS "Criar avaliacao" ON reviews;
CREATE POLICY "Criar avaliacao" ON reviews FOR INSERT WITH CHECK (
  auth.uid() = reviewer_id
  AND EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = booking_id
      AND b.client_id = auth.uid()
      AND b.status IN ('confirmed','completed')
  )
);

-- 6. BLOCKED_DATES (garante que existe com RLS correta, caso falte em algum ambiente)
CREATE TABLE IF NOT EXISTS blocked_dates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (property_id, date)
);
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Datas bloqueadas sao publicas" ON blocked_dates;
DROP POLICY IF EXISTS "Anfitriao bloqueia datas" ON blocked_dates;
DROP POLICY IF EXISTS "Anfitriao desbloqueia datas" ON blocked_dates;
CREATE POLICY "Datas bloqueadas sao publicas" ON blocked_dates FOR SELECT USING (true);
CREATE POLICY "Anfitriao bloqueia datas" ON blocked_dates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.host_id = auth.uid())
);
CREATE POLICY "Anfitriao desbloqueia datas" ON blocked_dates FOR DELETE USING (
  EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id AND p.host_id = auth.uid())
);
