-- PoolDay Database Schema
-- Cole este SQL no Supabase > SQL Editor > New Query

-- Tabela de perfis de usuários
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  city TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'host')),
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de espaços/piscinas
CREATE TABLE IF NOT EXISTS properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  rules TEXT,
  checkin_instructions TEXT,
  type TEXT NOT NULL DEFAULT 'pool' CHECK (type IN ('pool','chacara','gourmet','court','soccer','futevolei')),
  city TEXT NOT NULL,
  neighborhood TEXT,
  address TEXT,
  state TEXT,
  cep TEXT,
  price_per_day NUMERIC(10,2) NOT NULL DEFAULT 30,
  price_per_hour NUMERIC(10,2),
  max_capacity INTEGER NOT NULL DEFAULT 10,
  min_duration INTEGER DEFAULT 1,
  amenities TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  available_days INTEGER[] DEFAULT '{0,1,2,3,4,5,6}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de reservas
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  host_id UUID REFERENCES profiles(id) NOT NULL,
  client_id UUID REFERENCES profiles(id) NOT NULL,
  date DATE NOT NULL,
  guests INTEGER DEFAULT 1,
  total_amount NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2),
  host_amount NUMERIC(10,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de avaliações
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(id) NOT NULL,
  property_id UUID REFERENCES properties(id) NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de mensagens
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id) NOT NULL,
  receiver_id UUID REFERENCES profiles(id) NOT NULL,
  booking_id UUID REFERENCES bookings(id),
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storage bucket para imagens
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT DO NOTHING;

-- Políticas de segurança (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Profiles: qualquer um pode ler, só o dono pode editar
CREATE POLICY "Perfis públicos" ON profiles FOR SELECT USING (true);
CREATE POLICY "Usuário edita próprio perfil" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Usuário cria próprio perfil" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Properties: qualquer um pode ver ativos, só o dono pode editar
CREATE POLICY "Espaços ativos são públicos" ON properties FOR SELECT USING (is_active = true OR host_id = auth.uid());
CREATE POLICY "Anfitrião cria espaço" ON properties FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Anfitrião edita próprio espaço" ON properties FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Anfitrião deleta próprio espaço" ON properties FOR DELETE USING (auth.uid() = host_id);

-- Bookings: cliente e anfitrião veem suas reservas
CREATE POLICY "Ver próprias reservas" ON bookings FOR SELECT USING (auth.uid() = client_id OR auth.uid() = host_id);
CREATE POLICY "Cliente cria reserva" ON bookings FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Atualizar status da reserva" ON bookings FOR UPDATE USING (auth.uid() = host_id OR auth.uid() = client_id);

-- Reviews: públicas para leitura
CREATE POLICY "Avaliações públicas" ON reviews FOR SELECT USING (true);
CREATE POLICY "Criar avaliação" ON reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- Messages: só remetente e destinatário veem
CREATE POLICY "Ver próprias mensagens" ON messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Enviar mensagem" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Storage: qualquer um pode ver, autenticado pode fazer upload
CREATE POLICY "Imagens públicas" ON storage.objects FOR SELECT USING (bucket_id = 'property-images');
CREATE POLICY "Upload de imagens" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'property-images' AND auth.role() = 'authenticated');
CREATE POLICY "Deletar próprias imagens" ON storage.objects FOR DELETE USING (bucket_id = 'property-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger para criar perfil automaticamente após cadastro
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
