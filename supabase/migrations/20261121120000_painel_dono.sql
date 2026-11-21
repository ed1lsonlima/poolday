-- Painel de dono: contagem própria de visitas e um resumo de tudo, só para a administração.
-- Não apaga nem altera dados existentes. Só cria a tabela de visitas e duas funções.

-- 1. Visitas ----------------------------------------------------------------------------------------
-- Sem IP, sem nome e sem e-mail. visitor_id é um número aleatório guardado no navegador.
-- user_id só é preenchido para quem está logado, e vem do próprio login, nunca do navegador.

create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  session_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  path text not null,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  device text not null check (device in ('celular', 'tablet', 'computador')),
  city text,
  region text,
  created_at timestamptz not null default now()
);
create index if not exists site_visits_created_at_idx on public.site_visits (created_at desc);
create index if not exists site_visits_session_idx on public.site_visits (session_id, created_at desc);
alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;
grant all on public.site_visits to service_role;

-- Ninguém lê ou escreve direto na tabela: só por esta função, que limpa e limita o que chega.
create or replace function public.registrar_visita(p_visit jsonb)
returns void language plpgsql security definer set search_path to '' as $$
declare
  v_session uuid; v_visitor uuid; v_path text;
  clean text[] := array[]::text[];
begin
  begin
    v_session := (p_visit->>'session_id')::uuid;
    v_visitor := (p_visit->>'visitor_id')::uuid;
  exception when others then return;
  end;
  v_path := left(split_part(coalesce(p_visit->>'path', ''), '?', 1), 200);
  if v_session is null or v_visitor is null or v_path !~ '^/' then return; end if;
  -- Recarregar a mesma página em seguida não conta de novo, e uma sessão não passa de 300 páginas.
  if exists(select 1 from public.site_visits where session_id = v_session and path = v_path and created_at > now() - interval '10 seconds') then return; end if;
  if (select count(*) from public.site_visits where session_id = v_session) >= 300 then return; end if;
  insert into public.site_visits(visitor_id, session_id, user_id, path, referrer_host, utm_source, utm_medium, utm_campaign, device, city, region)
  values (v_visitor, v_session, (select id from public.profiles where id = auth.uid()), v_path,
    nullif(left(lower(regexp_replace(coalesce(p_visit->>'referrer_host', ''), '[^a-zA-Z0-9.-]', '', 'g')), 100), ''),
    nullif(left(lower(trim(coalesce(p_visit->>'utm_source', ''))), 60), ''),
    nullif(left(lower(trim(coalesce(p_visit->>'utm_medium', ''))), 60), ''),
    nullif(left(trim(coalesce(p_visit->>'utm_campaign', '')), 100), ''),
    case when p_visit->>'device' in ('celular', 'tablet', 'computador') then p_visit->>'device' else 'computador' end,
    nullif(left(trim(coalesce(p_visit->>'city', '')), 80), ''),
    nullif(left(trim(coalesce(p_visit->>'region', '')), 10), ''));
end $$;
revoke all on function public.registrar_visita(jsonb) from public;
grant execute on function public.registrar_visita(jsonb) to anon, authenticated, service_role;

-- 2. Resumo do painel ---------------------------------------------------------------------------------
-- Exige: estar em admin_members, conta não suspensa e sessão confirmada com o código do autenticador (aal2).
-- As visitas de quem é administrador não entram na conta.

create or replace function poolday_private.painel_autorizado()
returns boolean language sql stable security definer set search_path to '' as $$
  select coalesce(auth.jwt()->>'aal', '') = 'aal2' and exists(
    select 1 from public.admin_members m
    join public.profiles p on p.id = m.user_id and not p.suspended
    join auth.sessions s on s.user_id = m.user_id and s.aal = 'aal2' and (s.not_after is null or s.not_after > now())
    where m.user_id = auth.uid() and s.id::text = coalesce(auth.jwt()->>'session_id', ''));
$$;
revoke all on function poolday_private.painel_autorizado() from public, anon, authenticated;

create or replace function public.painel_dono(p_dias integer default 7)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  v_dias integer := greatest(1, least(coalesce(p_dias, 7), 365));
  v_desde timestamptz := date_trunc('day', now() at time zone 'America/Maceio') at time zone 'America/Maceio' - make_interval(days => v_dias - 1);
  v_result jsonb;
begin
  if not poolday_private.painel_autorizado() then raise exception 'ACESSO_NEGADO' using errcode = '42501'; end if;

  with v as (
    select sv.* from public.site_visits sv
    where sv.created_at >= v_desde and (sv.user_id is null or sv.user_id not in (select user_id from public.admin_members))
  ), dias as (
    select generate_series((v_desde at time zone 'America/Maceio')::date, (now() at time zone 'America/Maceio')::date, interval '1 day')::date as dia
  ), origem as (
    select coalesce(utm_source,
      case
        when referrer_host is null then 'direto'
        when referrer_host ~ 'instagram' then 'instagram'
        when referrer_host ~ '(tiktok)' then 'tiktok'
        when referrer_host ~ '(facebook|fb\.)' then 'facebook'
        when referrer_host ~ '(whatsapp|wa\.me)' then 'whatsapp'
        when referrer_host ~ 'google' then 'google'
        when referrer_host ~ 'pooldaybr|poolday' then 'direto'
        else referrer_host end) as fonte, session_id
    from (select distinct on (session_id) session_id, utm_source, referrer_host from v order by session_id, created_at) primeira
  )
  select jsonb_build_object(
    'dias', v_dias,
    'gerado_em', now(),
    'visitas', jsonb_build_object(
      'paginas', (select count(*) from v),
      'visitantes', (select count(distinct visitor_id) from v),
      'sessoes', (select count(distinct session_id) from v),
      'logados', (select count(distinct user_id) from v where user_id is not null),
      'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia,
          'visitantes', (select count(distinct visitor_id) from v where (v.created_at at time zone 'America/Maceio')::date = d.dia),
          'cadastros', (select count(*) from public.profiles p where (p.created_at at time zone 'America/Maceio')::date = d.dia)) order by d.dia), '[]') from dias d),
      'paginas_top', (select coalesce(jsonb_agg(x order by x.total desc), '[]') from (select path as nome, count(*) as total from v group by path order by count(*) desc limit 10) x),
      'origens', (select coalesce(jsonb_agg(x order by x.total desc), '[]') from (select fonte as nome, count(*) as total from origem group by fonte order by count(*) desc limit 10) x),
      'aparelhos', (select coalesce(jsonb_agg(x order by x.total desc), '[]') from (select device as nome, count(distinct session_id) as total from v group by device) x),
      'cidades', (select coalesce(jsonb_agg(x order by x.total desc), '[]') from (select city || coalesce(' / ' || region, '') as nome, count(distinct visitor_id) as total from v where city is not null group by city, region order by count(distinct visitor_id) desc limit 10) x),
      'campanhas', (select coalesce(jsonb_agg(x order by x.total desc), '[]') from (select concat_ws(' · ', utm_source, utm_medium, utm_campaign) as nome, count(distinct session_id) as total from v where utm_source is not null or utm_campaign is not null group by 1 order by 2 desc limit 10) x)
    ),
    'pessoas', jsonb_build_object(
      'clientes', (select count(*) from public.profiles where role = 'client'),
      'anfitrioes', (select count(*) from public.profiles where role = 'host'),
      'novos_no_periodo', (select count(*) from public.profiles where created_at >= v_desde),
      'leads_anfitriao', (select count(*) from public.leads_anfitriao),
      'ultimos_cadastros', (select coalesce(jsonb_agg(x order by x.criado desc), '[]') from (select coalesce(nullif(trim(name), ''), 'Sem nome') as nome, role as tipo, nullif(concat_ws(' / ', city, state), '') as cidade, created_at as criado from public.profiles order by created_at desc limit 15) x),
      'ultimos_acessos', (select coalesce(jsonb_agg(x order by x.quando desc), '[]') from (
          select * from (
            select distinct on (sv.user_id) coalesce(nullif(trim(p.name), ''), 'Sem nome') as nome, p.role as tipo, sv.path as pagina, sv.created_at as quando
            from v sv join public.profiles p on p.id = sv.user_id order by sv.user_id, sv.created_at desc) ultimo
          order by quando desc limit 15) x)
    ),
    'espacos', jsonb_build_object(
      'total', (select count(*) from public.properties),
      'no_ar', (select count(*) from public.properties where is_active and moderation_status = 'approved'),
      'em_analise', (select count(*) from public.properties where moderation_status = 'pending'),
      'pausados', (select count(*) from public.properties where moderation_status = 'approved' and not is_active),
      'recusados', (select count(*) from public.properties where moderation_status = 'rejected')
    ),
    'reservas', jsonb_build_object(
      'iniciadas_no_periodo', (select count(*) from public.bookings where created_at >= v_desde),
      'confirmadas', (select count(*) from public.bookings where status in ('confirmed', 'completed')),
      'aguardando_pagamento', (select count(*) from public.bookings where status = 'pending' and payment_state in ('awaiting_first_payment', 'deposit_paid', 'awaiting_balance')),
      'canceladas', (select count(*) from public.bookings where status = 'cancelled'),
      'proximas', (select coalesce(jsonb_agg(x order by x.data), '[]') from (select b.date as data, coalesce(pr.name, 'Espaço') as espaco, b.status, b.total_amount as total from public.bookings b left join public.properties pr on pr.id = b.property_id where b.date >= (now() at time zone 'America/Maceio')::date and b.status in ('pending', 'confirmed') order by b.date limit 10) x)
    ),
    'dinheiro', jsonb_build_object(
      'pago_total', (select coalesce(sum(amount - refunded_amount), 0) from public.payment_ledger where status = 'approved'),
      'pago_no_periodo', (select coalesce(sum(amount - refunded_amount), 0) from public.payment_ledger where status = 'approved' and payment_created_at >= v_desde),
      'comissao_total', (select coalesce(sum(platform_fee), 0) from public.payment_ledger where status = 'approved' and refunded_amount = 0),
      'devolvido_total', (select coalesce(sum(refunded_amount), 0) from public.payment_ledger)
    ),
    'alertas', jsonb_build_object(
      'abertos', (select count(*) from public.admin_events where resolved_at is null and coalesce(severity, 'info') <> 'info'),
      'urgentes', (select count(*) from public.admin_events where resolved_at is null and severity = 'urgent'),
      'lista', (select coalesce(jsonb_agg(x order by x.quando desc), '[]') from (select title as titulo, severity as gravidade, created_at as quando from public.admin_events where resolved_at is null and coalesce(severity, 'info') <> 'info' order by created_at desc limit 8) x)
    ),
    'indicacoes', jsonb_build_object(
      'indicadores', (select count(*) from public.indicadores),
      'em_andamento', (select count(*) from public.indicacoes where status in ('cadastrou', 'aguardando_aprovacao')),
      'a_pagar', (select count(*) from public.indicacoes where status = 'a_pagar'),
      'pagas', (select count(*) from public.indicacoes where status = 'paga')
    )
  ) into v_result;
  return v_result;
end $$;
revoke all on function public.painel_dono(integer) from public, anon;
grant execute on function public.painel_dono(integer) to authenticated;
