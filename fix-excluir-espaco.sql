-- ============================================================
-- FIX: botão "Excluir espaço" não funcionava
-- Causa: faltava a política de RLS de DELETE na tabela properties.
-- Sem ela, o Supabase apaga 0 linhas sem dar erro (delete silencioso).
-- Rode este bloco no Supabase → SQL Editor → Run.
-- ============================================================

-- Garante que o RLS está ligado (não quebra se já estiver)
alter table public.properties enable row level security;

-- Permite que o anfitrião exclua APENAS os próprios espaços
drop policy if exists "hosts can delete own properties" on public.properties;
create policy "hosts can delete own properties"
  on public.properties
  for delete
  using (auth.uid() = host_id);

-- ============================================================
-- OPCIONAL — só rode se você quiser conseguir excluir também
-- espaços que JÁ TÊM reservas/avaliações/favoritos de teste.
-- ATENÇÃO: isso faz com que excluir um espaço APAGUE JUNTO as
-- reservas, avaliações e favoritos ligados a ele (não dá pra
-- desfazer). Para dados de teste é ok; em produção, prefira
-- PAUSAR o espaço em vez de excluir.
--
-- Os nomes das constraints podem variar no seu banco. Se der
-- erro de "constraint does not exist", me avisa que eu ajusto
-- olhando o schema.
-- ============================================================
-- alter table public.bookings  drop constraint if exists bookings_property_id_fkey;
-- alter table public.bookings  add  constraint bookings_property_id_fkey
--   foreign key (property_id) references public.properties(id) on delete cascade;
--
-- alter table public.reviews   drop constraint if exists reviews_property_id_fkey;
-- alter table public.reviews   add  constraint reviews_property_id_fkey
--   foreign key (property_id) references public.properties(id) on delete cascade;
--
-- alter table public.favorites drop constraint if exists favorites_property_id_fkey;
-- alter table public.favorites add  constraint favorites_property_id_fkey
--   foreign key (property_id) references public.properties(id) on delete cascade;
