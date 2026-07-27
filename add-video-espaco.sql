-- ============================================================
-- Suporte a VÍDEO nos espaços (link do YouTube/Instagram/TikTok).
-- Guarda só o link — não hospeda arquivo, zero custo de banda.
-- Rode no Supabase → SQL Editor → Run.
-- ============================================================
alter table public.properties add column if not exists video_url text;
