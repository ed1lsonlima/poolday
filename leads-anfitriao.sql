-- ============================================================
-- TABELA DE LEADS DA LANDING PAGE "SEJA ANFITRIÃO" (/seja-anfitriao)
-- Guarda quem preencheu o formulário do anúncio do Google Ads.
-- O lead é gravado ANTES de a pessoa criar a conta, então mesmo
-- quem desiste no meio fica visível pra você resgatar no WhatsApp.
--
-- Rode este SQL no Supabase (SQL Editor) uma única vez.
-- ============================================================

create table if not exists public.leads_anfitriao (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  nome         text not null,
  whatsapp     text not null,
  cidade       text,
  tipo_espaco  text,
  -- de onde veio (utm da campanha), pra você medir depois
  origem       text default 'google-ads',
  -- acompanhamento manual: novo / contatado / cadastrado / descartado
  status       text not null default 'novo'
);

-- Índice pra listar os mais recentes primeiro (você vai olhar por data)
create index if not exists leads_anfitriao_created_idx
  on public.leads_anfitriao (created_at desc);

-- ── SEGURANÇA (RLS) ─────────────────────────────────────────
-- Liga o RLS: sem política, ninguém acessa via API pública.
alter table public.leads_anfitriao enable row level security;

-- Qualquer visitante (sem login) PODE inserir um lead pelo formulário.
-- Só INSERT — não dá pra ler nem editar os leads pela chave pública.
drop policy if exists "qualquer um pode enviar lead" on public.leads_anfitriao;
create policy "qualquer um pode enviar lead"
  on public.leads_anfitriao
  for insert
  to anon, authenticated
  with check (true);

-- IMPORTANTE: NÃO existe política de SELECT de propósito.
-- Assim os dados dos leads (nome/WhatsApp) NÃO vazam pela API.
-- Você lê a lista com segurança direto no painel do Supabase:
--   Table Editor → leads_anfitriao  (ordene por created_at desc)
-- ============================================================
