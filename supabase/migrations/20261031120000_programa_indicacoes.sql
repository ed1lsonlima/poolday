-- Programa de indicações: R$ 20 por anfitrião novo, devidos quando o primeiro
-- espaço dele é aprovado pela administração. Pagamento manual por Pix.
-- Não altera taxas, promoção, cancelamento nem pagamentos de reservas.
-- Não apaga nem altera dados existentes: só cria tabelas, colunas e funções novas.
begin;

-- Indicadores: só a própria pessoa lê a sua linha (inclusive a própria chave Pix).
create table if not exists public.indicadores (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  codigo text not null unique check (codigo ~ '^[a-z0-9]{6,12}$'),
  nome text check (nome is null or char_length(nome) between 2 and 80),
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  chave_pix text check (chave_pix is null or char_length(chave_pix) between 5 and 140),
  ativo boolean not null default true,
  desativado_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indicações: uma por anfitrião (vale uma vez por anfitrião). Só o servidor lê a tabela.
create table if not exists public.indicacoes (
  id uuid primary key default gen_random_uuid(),
  indicador_id uuid not null references public.indicadores(user_id) on delete restrict,
  anfitriao_id uuid not null unique references public.profiles(id) on delete restrict,
  property_id uuid references public.properties(id) on delete set null,
  status text not null default 'cadastrou'
    check (status in ('cadastrou','aguardando_aprovacao','a_pagar','paga','recusada')),
  valor_centavos integer not null default 2000 check (valor_centavos = 2000),
  created_at timestamptz not null default now(),
  aguardando_em timestamptz,
  aprovada_em timestamptz,
  paga_em timestamptz,
  recusada_em timestamptz,
  pagamento_observacao text check (pagamento_observacao is null or char_length(pagamento_observacao) <= 500),
  recusa_motivo text check (recusa_motivo is null or char_length(recusa_motivo) <= 500),
  updated_at timestamptz not null default now()
);
create index if not exists indicacoes_indicador_status_idx on public.indicacoes (indicador_id, status);
create index if not exists indicacoes_property_idx on public.indicacoes (property_id) where property_id is not null;

alter table public.indicadores enable row level security;
alter table public.indicacoes enable row level security;
revoke all on public.indicadores, public.indicacoes from public, anon, authenticated;
grant all on public.indicadores, public.indicacoes to service_role;
grant select on public.indicadores to authenticated;
drop policy if exists "Indicador lê a própria linha" on public.indicadores;
create policy "Indicador lê a própria linha" on public.indicadores
  for select to authenticated using (user_id = (select auth.uid()));
-- Sem política em indicacoes: o indicador lê o próprio histórico pela função minhas_indicacoes().

-- O formulário de interesse guarda o código de quem indicou (opcional).
alter table public.leads_anfitriao add column if not exists codigo_indicacao text;
alter table public.leads_anfitriao drop constraint if exists leads_anfitriao_codigo_indicacao_check;
alter table public.leads_anfitriao add constraint leads_anfitriao_codigo_indicacao_check
  check (codigo_indicacao is null or codigo_indicacao ~ '^[a-z0-9]{6,12}$');

create or replace function poolday_private.so_digitos(p text) returns text
language sql immutable set search_path = '' as $$
  select nullif(right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 11), '');
$$;

-- Cadastro ou atualização do indicador. Exige conta de cliente ativa.
create or replace function public.salvar_indicador(p_nome text, p_whatsapp text, p_chave_pix text)
returns public.indicadores
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_row public.indicadores; v_codigo text; v_whats text;
begin
  if v_uid is null then raise exception 'LOGIN_NECESSARIO'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'client' and not suspended) then
    raise exception 'CONTA_CLIENTE_NECESSARIA';
  end if;
  v_whats := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
  if char_length(trim(coalesce(p_nome, ''))) not between 2 and 80 then raise exception 'NOME_INVALIDO'; end if;
  if v_whats !~ '^[0-9]{10,13}$' then raise exception 'WHATSAPP_INVALIDO'; end if;
  if char_length(trim(coalesce(p_chave_pix, ''))) not between 5 and 140 then raise exception 'PIX_INVALIDO'; end if;

  select * into v_row from public.indicadores where user_id = v_uid for update;
  if found then
    update public.indicadores set nome = trim(p_nome), whatsapp = v_whats, chave_pix = trim(p_chave_pix), updated_at = now()
    where user_id = v_uid returning * into v_row;
    return v_row;
  end if;
  loop
    v_codigo := substr(md5(gen_random_uuid()::text), 1, 8);
    exit when not exists (select 1 from public.indicadores where codigo = v_codigo);
  end loop;
  insert into public.indicadores (user_id, codigo, nome, whatsapp, chave_pix)
  values (v_uid, v_codigo, trim(p_nome), v_whats, trim(p_chave_pix)) returning * into v_row;
  return v_row;
end;
$$;

-- Histórico do indicador sem dados privados do anfitrião (só o primeiro nome).
create or replace function public.minhas_indicacoes()
returns table (id uuid, anfitriao_primeiro_nome text, status text, valor_centavos integer,
  created_at timestamptz, aprovada_em timestamptz, paga_em timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, coalesce(nullif(split_part(trim(p.name), ' ', 1), ''), 'Anfitrião'), i.status, i.valor_centavos,
    i.created_at, i.aprovada_em, i.paga_em
  from public.indicacoes i join public.profiles p on p.id = i.anfitriao_id
  where i.indicador_id = (select auth.uid())
  order by i.created_at desc;
$$;

-- Chamado pelo próprio anfitrião logo após criar a conta, com o código guardado do link.
-- Retorna um código de situação; nunca revela dados de quem indicou.
create or replace function public.registrar_indicacao(p_codigo text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_host public.profiles; v_ind public.indicadores;
  v_host_email text; v_ind_email text; v_ind_phone text; v_host_phones text[]; v_pix text; v_property uuid;
begin
  if v_uid is null then return 'LOGIN_NECESSARIO'; end if;
  if coalesce(p_codigo, '') !~ '^[a-z0-9]{6,12}$' then return 'CODIGO_INVALIDO'; end if;
  select * into v_host from public.profiles where id = v_uid;
  if not found or v_host.role <> 'host' or v_host.suspended then return 'NAO_E_ANFITRIAO'; end if;
  if exists (select 1 from public.indicacoes where anfitriao_id = v_uid) then return 'JA_REGISTRADA'; end if;
  -- Quem já tinha conta não conta como indicação nova.
  if v_host.created_at < now() - interval '72 hours'
     or exists (select 1 from public.properties where host_id = v_uid and moderation_status = 'approved') then
    return 'CONTA_ANTIGA';
  end if;
  select * into v_ind from public.indicadores where codigo = p_codigo;
  if not found or not v_ind.ativo then return 'CODIGO_INVALIDO'; end if;

  -- Autoindicação: mesma conta, mesmo e-mail, mesmo telefone/WhatsApp, ou Pix igual a dado do anfitrião.
  -- O PoolDay não coleta CPF no cadastro; se a chave Pix for um CPF, ela é comparada aos dados disponíveis.
  select lower(email) into v_host_email from auth.users where id = v_uid;
  select lower(u.email), poolday_private.so_digitos(p.phone) into v_ind_email, v_ind_phone
    from auth.users u join public.profiles p on p.id = u.id where u.id = v_ind.user_id;
  -- Telefones do anfitrião: o do perfil e o WhatsApp do formulário de interesse enviado com este código.
  v_host_phones := array_remove(array[poolday_private.so_digitos(v_host.phone)] || array(
    select poolday_private.so_digitos(l.whatsapp) from public.leads_anfitriao l
    where l.codigo_indicacao = p_codigo and lower(trim(l.nome)) = lower(trim(v_host.name))), null);
  v_pix := lower(trim(coalesce(v_ind.chave_pix, '')));
  if v_ind.user_id = v_uid
     or v_ind_email = v_host_email
     or (v_ind_phone is not null and v_ind_phone = any(v_host_phones))
     or (poolday_private.so_digitos(v_ind.whatsapp) = any(v_host_phones))
     or v_pix = v_host_email
     or (poolday_private.so_digitos(v_pix) is not null and poolday_private.so_digitos(v_pix) = any(v_host_phones)) then
    insert into public.admin_events (event_key, kind, severity, title, detail, entity_id)
    values ('autoindicacao:' || v_uid, 'referral_self', 'review', 'Tentativa de autoindicação bloqueada',
      'O anfitrião usou um link com dados iguais aos dele. Nenhuma indicação foi registrada.', v_uid)
    on conflict (event_key) do nothing;
    return 'AUTOINDICACAO';
  end if;

  -- Se o anfitrião já enviou um espaço antes de registrar o código, a indicação começa aguardando aprovação.
  select id into v_property from public.properties where host_id = v_uid order by created_at limit 1;
  insert into public.indicacoes (indicador_id, anfitriao_id, status, property_id, aguardando_em)
  values (v_ind.user_id, v_uid, case when v_property is null then 'cadastrou' else 'aguardando_aprovacao' end,
    v_property, case when v_property is null then null else now() end)
  on conflict (anfitriao_id) do nothing;
  return 'REGISTRADA';
end;
$$;

-- Avanço automático: espaço enviado → aguardando aprovação; primeiro espaço aprovado → a pagar.
-- Idempotente: só avança a partir dos estados anteriores e nunca volta.
create or replace function poolday_private.avancar_indicacao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_ind public.indicacoes; v_ativo boolean; v_no_mes integer;
begin
  if new.moderation_status = 'pending' then
    update public.indicacoes set status = 'aguardando_aprovacao', property_id = coalesce(property_id, new.id),
      aguardando_em = coalesce(aguardando_em, now()), updated_at = now()
    where anfitriao_id = new.host_id and status = 'cadastrou';
    return new;
  end if;
  if new.moderation_status <> 'approved' or (tg_op = 'UPDATE' and old.moderation_status = 'approved') then return new; end if;

  select * into v_ind from public.indicacoes
  where anfitriao_id = new.host_id and status in ('cadastrou', 'aguardando_aprovacao') for update;
  if not found then return new; end if;
  -- Serializa a contagem do limite mensal por indicador.
  perform pg_advisory_xact_lock(hashtextextended('indicador:' || v_ind.indicador_id, 0));
  select ativo into v_ativo from public.indicadores where user_id = v_ind.indicador_id;
  select count(*) into v_no_mes from public.indicacoes
  where indicador_id = v_ind.indicador_id and status in ('a_pagar', 'paga')
    and date_trunc('month', aprovada_em at time zone 'America/Sao_Paulo') = date_trunc('month', now() at time zone 'America/Sao_Paulo');

  if not coalesce(v_ativo, false) then
    update public.indicacoes set status = 'recusada', recusada_em = now(), property_id = new.id, updated_at = now(),
      recusa_motivo = 'Link do indicador desativado.' where id = v_ind.id;
  elsif v_no_mes >= 10 then
    update public.indicacoes set status = 'recusada', recusada_em = now(), property_id = new.id, updated_at = now(),
      recusa_motivo = 'Limite de 10 indicações pagas no mês atingido.' where id = v_ind.id;
  else
    update public.indicacoes set status = 'a_pagar', aprovada_em = now(), property_id = new.id, updated_at = now()
    where id = v_ind.id;
  end if;
  return new;
end;
$$;
drop trigger if exists avancar_indicacao on public.properties;
create trigger avancar_indicacao after insert or update of moderation_status on public.properties
for each row execute function poolday_private.avancar_indicacao();

-- Ações da administração (somente servidor, com auditoria).
create or replace function public.admin_indicacao_acao(p_actor uuid, p_acao text, p_id uuid, p_texto text, p_pago_em date default null)
returns void
language plpgsql security invoker set search_path = '' as $$
declare v_before jsonb; v_after jsonb; v_texto text := trim(coalesce(p_texto, ''));
begin
  if not exists (select 1 from public.admin_members where user_id = p_actor) then raise exception 'FORBIDDEN'; end if;
  if char_length(v_texto) not between 5 and 500 then raise exception 'Informe a observação (5 a 500 caracteres)'; end if;
  if p_acao in ('marcar_indicacao_paga', 'recusar_indicacao') then
    select to_jsonb(i) into v_before from public.indicacoes i where id = p_id for update;
    if v_before is null then raise exception 'Indicação não encontrada'; end if;
    if p_acao = 'marcar_indicacao_paga' then
      if v_before->>'status' <> 'a_pagar' then raise exception 'Só indicações a pagar podem ser marcadas como pagas'; end if;
      if p_pago_em is null or p_pago_em > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Data de pagamento inválida'; end if;
      update public.indicacoes set status = 'paga', paga_em = (p_pago_em::timestamp + time '12:00') at time zone 'America/Sao_Paulo',
        pagamento_observacao = v_texto, updated_at = now() where id = p_id returning to_jsonb(indicacoes) into v_after;
    else
      if v_before->>'status' = 'paga' then raise exception 'Indicação já paga não pode ser recusada'; end if;
      update public.indicacoes set status = 'recusada', recusada_em = now(), recusa_motivo = v_texto, updated_at = now()
      where id = p_id returning to_jsonb(indicacoes) into v_after;
    end if;
  elsif p_acao in ('desativar_indicador', 'reativar_indicador') then
    select to_jsonb(r) - 'chave_pix' into v_before from public.indicadores r where user_id = p_id for update;
    if v_before is null then raise exception 'Indicador não encontrado'; end if;
    update public.indicadores set ativo = p_acao = 'reativar_indicador',
      desativado_motivo = case when p_acao = 'desativar_indicador' then v_texto end, updated_at = now()
    where user_id = p_id returning to_jsonb(indicadores) - 'chave_pix' into v_after;
  else
    raise exception 'Ação inválida';
  end if;
  insert into public.admin_audit (actor_id, action, entity_id, reason, before_data, after_data)
  values (p_actor, p_acao, p_id, v_texto, v_before, v_after);
end;
$$;

revoke all on function poolday_private.so_digitos(text), poolday_private.avancar_indicacao() from public, anon, authenticated;
revoke all on function public.salvar_indicador(text, text, text), public.minhas_indicacoes(),
  public.registrar_indicacao(text), public.admin_indicacao_acao(uuid, text, uuid, text, date) from public, anon, authenticated;
grant execute on function public.salvar_indicador(text, text, text), public.minhas_indicacoes(), public.registrar_indicacao(text) to authenticated;
grant execute on function public.admin_indicacao_acao(uuid, text, uuid, text, date) to service_role;
grant execute on function poolday_private.so_digitos(text) to service_role;

commit;
