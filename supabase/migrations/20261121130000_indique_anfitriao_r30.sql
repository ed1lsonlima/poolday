-- Programa "Indique um anfitrião": R$ 30 por dono de espaço, pagos quando o primeiro espaço dele é aprovado,
-- válido para as primeiras 20 aprovações. Evolui o programa de R$ 20 (que não tinha nenhum participante).
-- Não apaga nem altera dados existentes. Não muda taxas, promoção, cancelamento nem pagamentos de reservas.

-- 1. Configuração (valor, vagas, ligado/desligado) num lugar só ----------------------------------

create table if not exists public.programa_indicacao (
  id boolean primary key default true check (id),
  ativo boolean not null default true,
  valor_centavos integer not null default 3000 check (valor_centavos between 100 and 100000),
  vagas integer not null default 20 check (vagas between 1 and 1000),
  tolerancia_dias integer not null default 30 check (tolerancia_dias between 0 and 365),
  encerrado_em timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.programa_indicacao (id) values (true) on conflict (id) do nothing;
alter table public.programa_indicacao enable row level security;
revoke all on public.programa_indicacao from public, anon, authenticated;
grant all on public.programa_indicacao to service_role;

-- 2. Indicadores e indicações ---------------------------------------------------------------------

alter table public.indicadores add column if not exists cpf text;
alter table public.indicadores add column if not exists email text;
alter table public.indicadores add column if not exists aceite_regras_em timestamptz;
alter table public.indicadores add column if not exists utm_source text;
alter table public.indicadores add column if not exists utm_medium text;
alter table public.indicadores add column if not exists utm_campaign text;
alter table public.indicadores drop constraint if exists indicadores_cpf_check;
alter table public.indicadores add constraint indicadores_cpf_check check (cpf is null or cpf ~ '^[0-9]{11}$');
-- Códigos novos são maiúsculos (ex.: EDI4K2Q). A tabela está vazia, então nada precisa ser convertido.
alter table public.indicadores drop constraint if exists indicadores_codigo_check;
alter table public.indicadores add constraint indicadores_codigo_check check (codigo ~ '^[A-Z0-9]{6,12}$');
alter table public.leads_anfitriao drop constraint if exists leads_anfitriao_codigo_indicacao_check;
alter table public.leads_anfitriao add constraint leads_anfitriao_codigo_indicacao_check
  check (codigo_indicacao is null or codigo_indicacao ~ '^[A-Za-z0-9]{6,12}$');

alter table public.indicacoes drop constraint if exists indicacoes_valor_centavos_check;
alter table public.indicacoes add constraint indicacoes_valor_centavos_check check (valor_centavos >= 0);
alter table public.indicacoes alter column valor_centavos set default 0;
alter table public.indicacoes drop constraint if exists indicacoes_status_check;
alter table public.indicacoes add constraint indicacoes_status_check
  check (status in ('cadastrou', 'aguardando_aprovacao', 'a_pagar', 'paga', 'recusada', 'sem_recompensa'));
alter table public.indicacoes add column if not exists clicado_em timestamptz;
alter table public.indicacoes add column if not exists verificacao jsonb;
alter table public.indicacoes add column if not exists verificado_em timestamptz;
alter table public.indicacoes add column if not exists verificado_por uuid;

-- CPF do anfitrião, pedido no cadastro. Só o próprio anfitrião e a administração leem.
create table if not exists public.documentos_anfitriao (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  cpf text not null check (cpf ~ '^[0-9]{11}$'),
  created_at timestamptz not null default now()
);
alter table public.documentos_anfitriao enable row level security;
revoke all on public.documentos_anfitriao from public, anon, authenticated;
grant select on public.documentos_anfitriao to authenticated;
grant all on public.documentos_anfitriao to service_role;
drop policy if exists "Anfitriao le o proprio documento" on public.documentos_anfitriao;
create policy "Anfitriao le o proprio documento" on public.documentos_anfitriao
  for select to authenticated using (user_id = (select auth.uid()));

-- 3. Validações -------------------------------------------------------------------------------------

create or replace function poolday_private.cpf_valido(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'); s int; r int; i int;
begin
  if d !~ '^[0-9]{11}$' or d ~ '^(\d)\1{10}$' then return false; end if;
  s := 0; for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(d, 10, 1)::int then return false; end if;
  s := 0; for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = substr(d, 11, 1)::int;
end $$;

create or replace function poolday_private.cnpj_valido(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'); pesos1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  pesos2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2]; s int; r int; i int;
begin
  if d !~ '^[0-9]{14}$' or d ~ '^(\d)\1{13}$' then return false; end if;
  s := 0; for i in 1..12 loop s := s + substr(d, i, 1)::int * pesos1[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  if r <> substr(d, 13, 1)::int then return false; end if;
  s := 0; for i in 1..13 loop s := s + substr(d, i, 1)::int * pesos2[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  return r = substr(d, 14, 1)::int;
end $$;

-- Devolve a chave Pix normalizada, ou null se não for CPF, CNPJ, e-mail, celular ou chave aleatória válida.
create or replace function poolday_private.pix_normalizado(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := lower(trim(coalesce(p, ''))); d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if v ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return v; end if;
  if v ~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' and char_length(v) <= 77 then return v; end if;
  if v ~ '^[0-9.\-/ ]+$' and poolday_private.cpf_valido(d) then return d; end if;
  if v ~ '^[0-9.\-/ ]+$' and poolday_private.cnpj_valido(d) then return d; end if;
  if v ~ '^\+?[0-9() \-]+$' and d ~ '^(55)?[1-9][0-9]9[0-9]{8}$' then return '+55' || right(d, 11); end if;
  return null;
end $$;

-- 4. Avisos para o indicador (aparecem no sino do site) ---------------------------------------------

create or replace function poolday_private.avisar_indicador(p_user uuid, p_chave text, p_titulo text, p_texto text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (event_key, user_id, booking_id, kind, title, message, action_url)
  values (p_chave, p_user, null, 'referral', p_titulo, p_texto, '/indique/painel')
  on conflict (event_key) do nothing;
$$;

create or replace function poolday_private.reais(p_centavos integer) returns text
language sql immutable set search_path = '' as $$
  select 'R$ ' || replace(to_char(p_centavos / 100.0, 'FM999990D00'), '.', ',');
$$;

-- 5. Leitura pública: vagas e primeiro nome de quem indicou ----------------------------------------

create or replace function public.programa_indicacao_publico()
returns table (ativo boolean, valor_centavos integer, vagas integer, vagas_restantes integer, encerrado boolean)
language sql stable security definer set search_path = '' as $$
  select c.ativo and c.encerrado_em is null, c.valor_centavos, c.vagas,
    greatest(c.vagas - (select count(*)::int from public.indicacoes where status in ('a_pagar', 'paga') and valor_centavos > 0), 0),
    not c.ativo or c.encerrado_em is not null
  from public.programa_indicacao c;
$$;

create or replace function public.indicador_por_codigo(p_codigo text)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(split_part(trim(i.nome), ' ', 1), ''), 'um amigo')
  from public.indicadores i where i.codigo = upper(trim(coalesce(p_codigo, ''))) and i.ativo;
$$;

-- 6. Virar indicador ----------------------------------------------------------------------------------
-- Qualquer conta ativa pode indicar. Exige CPF e Pix válidos e o aceite das regras.

drop function if exists public.salvar_indicador(text, text, text);
create or replace function public.salvar_indicador(p_nome text, p_whatsapp text, p_cpf text, p_chave_pix text, p_aceite boolean,
  p_utm_source text default null, p_utm_medium text default null, p_utm_campaign text default null)
returns public.indicadores
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_row public.indicadores; v_codigo text; v_whats text; v_cpf text; v_pix text;
  v_prefixo text; v_cfg public.programa_indicacao; v_email text;
begin
  if v_uid is null then raise exception 'LOGIN_NECESSARIO'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and not suspended) then raise exception 'CONTA_SUSPENSA'; end if;
  if not coalesce(p_aceite, false) then raise exception 'ACEITE_NECESSARIO'; end if;
  v_whats := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
  v_cpf := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  v_pix := poolday_private.pix_normalizado(p_chave_pix);
  if char_length(trim(coalesce(p_nome, ''))) not between 2 and 80 then raise exception 'NOME_INVALIDO'; end if;
  if v_whats !~ '^(55)?[1-9][0-9]9?[0-9]{8}$' then raise exception 'WHATSAPP_INVALIDO'; end if;
  if not poolday_private.cpf_valido(v_cpf) then raise exception 'CPF_INVALIDO'; end if;
  if v_pix is null then raise exception 'PIX_INVALIDO'; end if;
  select lower(email) into v_email from auth.users where id = v_uid;

  select * into v_row from public.indicadores where user_id = v_uid for update;
  if found then
    update public.indicadores set nome = trim(p_nome), whatsapp = right(v_whats, 11), cpf = v_cpf, chave_pix = v_pix, email = v_email,
      aceite_regras_em = coalesce(aceite_regras_em, now()), updated_at = now()
    where user_id = v_uid returning * into v_row;
    return v_row;
  end if;

  select * into v_cfg from public.programa_indicacao;
  if not v_cfg.ativo or v_cfg.encerrado_em is not null then raise exception 'VAGAS_ENCERRADAS'; end if;
  v_prefixo := rpad(left(regexp_replace(upper(translate(trim(p_nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')), '[^A-Z]', '', 'g'), 3), 3, 'P');
  loop
    -- Sem letras e números que se confundem. 4 caracteres aleatórios: o código não segue sequência.
    v_codigo := v_prefixo || (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '')
      from (select uuid_send(gen_random_uuid()) as b) x, generate_series(0, 3) i);
    exit when not exists (select 1 from public.indicadores where codigo = v_codigo);
  end loop;
  insert into public.indicadores (user_id, codigo, nome, whatsapp, cpf, chave_pix, email, aceite_regras_em, utm_source, utm_medium, utm_campaign)
  values (v_uid, v_codigo, trim(p_nome), right(v_whats, 11), v_cpf, v_pix, v_email, now(),
    nullif(left(trim(coalesce(p_utm_source, '')), 60), ''), nullif(left(trim(coalesce(p_utm_medium, '')), 60), ''), nullif(left(trim(coalesce(p_utm_campaign, '')), 100), ''))
  returning * into v_row;
  return v_row;
end;
$$;

-- 7. CPF do anfitrião ----------------------------------------------------------------------------------

create or replace function public.salvar_cpf_anfitriao(p_cpf text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_cpf text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g'); v_atual text;
begin
  if v_uid is null then return 'LOGIN_NECESSARIO'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'host') then return 'NAO_E_ANFITRIAO'; end if;
  if not poolday_private.cpf_valido(v_cpf) then return 'CPF_INVALIDO'; end if;
  select cpf into v_atual from public.documentos_anfitriao where user_id = v_uid;
  if v_atual is not null then return case when v_atual = v_cpf then 'SALVO' else 'JA_INFORMADO' end; end if;
  insert into public.documentos_anfitriao (user_id, cpf) values (v_uid, v_cpf);
  if exists (select 1 from public.documentos_anfitriao where cpf = v_cpf and user_id <> v_uid) then
    insert into public.admin_events (event_key, kind, severity, title, detail, entity_id)
    values ('cpf-repetido:' || v_uid, 'referral_self', 'review', 'CPF repetido em mais de uma conta de anfitrião', 'Confira se é a mesma pessoa com contas diferentes.', v_uid)
    on conflict (event_key) do nothing;
  end if;
  return 'SALVO';
end;
$$;

-- 8. Autoindicação: mesmo CPF, e-mail, WhatsApp ou Pix entre indicador e anfitrião ----------------------

create or replace function poolday_private.autoindicacao(p_indicador uuid, p_anfitriao uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare i public.indicadores; h public.profiles; h_email text; h_cpf text; h_phone text; i_phone text; motivos text[] := array[]::text[];
begin
  select * into i from public.indicadores where user_id = p_indicador;
  select * into h from public.profiles where id = p_anfitriao;
  select lower(email) into h_email from auth.users where id = p_anfitriao;
  select cpf into h_cpf from public.documentos_anfitriao where user_id = p_anfitriao;
  h_phone := right(regexp_replace(coalesce(h.phone, ''), '[^0-9]', '', 'g'), 11);
  i_phone := right(regexp_replace(coalesce(i.whatsapp, ''), '[^0-9]', '', 'g'), 11);
  if p_indicador = p_anfitriao then motivos := array_append(motivos, 'mesma conta'); end if;
  if h_cpf is not null and (h_cpf = i.cpf or h_cpf = i.chave_pix) then motivos := array_append(motivos, 'mesmo CPF'); end if;
  if h_email is not null and (h_email = lower(i.email) or h_email = lower(i.chave_pix)) then motivos := array_append(motivos, 'mesmo e-mail'); end if;
  if char_length(h_phone) >= 10 and (h_phone = i_phone or '+55' || h_phone = i.chave_pix) then motivos := array_append(motivos, 'mesmo WhatsApp'); end if;
  return nullif(array_to_string(motivos, ', '), '');
end;
$$;

-- 9. Registro da indicação, chamado pelo anfitrião logo depois de criar a conta -----------------------

drop function if exists public.registrar_indicacao(text);
create or replace function public.registrar_indicacao(p_codigo text, p_clicado_em timestamptz default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_host public.profiles; v_ind public.indicadores; v_codigo text := upper(trim(coalesce(p_codigo, '')));
  v_property uuid; v_motivo text; v_cfg public.programa_indicacao;
begin
  if v_uid is null then return 'LOGIN_NECESSARIO'; end if;
  if v_codigo !~ '^[A-Z0-9]{6,12}$' then return 'CODIGO_INVALIDO'; end if;
  select * into v_host from public.profiles where id = v_uid;
  if not found or v_host.role <> 'host' or v_host.suspended then return 'NAO_E_ANFITRIAO'; end if;
  if exists (select 1 from public.indicacoes where anfitriao_id = v_uid) then return 'JA_REGISTRADA'; end if;
  -- Quem já era anfitrião antes da indicação não conta.
  if v_host.created_at < now() - interval '72 hours'
     or exists (select 1 from public.properties where host_id = v_uid and moderation_status = 'approved') then
    return 'CONTA_ANTIGA';
  end if;
  select * into v_ind from public.indicadores where codigo = v_codigo;
  if not found or not v_ind.ativo then return 'CODIGO_INVALIDO'; end if;
  select * into v_cfg from public.programa_indicacao;
  if not v_cfg.ativo then return 'PROGRAMA_DESLIGADO'; end if;

  v_motivo := poolday_private.autoindicacao(v_ind.user_id, v_uid);
  if v_motivo is not null then
    insert into public.admin_events (event_key, kind, severity, title, detail, entity_id)
    values ('autoindicacao:' || v_uid, 'referral_self', 'review', 'Tentativa de autoindicação bloqueada',
      'Dados iguais entre quem indicou e o anfitrião (' || v_motivo || '). Nenhuma indicação foi registrada.', v_uid)
    on conflict (event_key) do nothing;
    return 'AUTOINDICACAO';
  end if;

  select id into v_property from public.properties where host_id = v_uid order by created_at limit 1;
  insert into public.indicacoes (indicador_id, anfitriao_id, status, property_id, aguardando_em, clicado_em)
  values (v_ind.user_id, v_uid, case when v_property is null then 'cadastrou' else 'aguardando_aprovacao' end,
    v_property, case when v_property is null then null else now() end,
    case when p_clicado_em between now() - interval '60 days' and now() then p_clicado_em end)
  on conflict (anfitriao_id) do nothing;
  perform poolday_private.avisar_indicador(v_ind.user_id, 'indicacao-conta:' || v_uid, 'Alguém criou a conta pelo seu link',
    'Boa notícia: ' || coalesce(nullif(split_part(trim(v_host.name), ' ', 1), ''), 'o anfitrião') || ' criou a conta pelo seu link! Você recebe os '
    || poolday_private.reais(v_cfg.valor_centavos) || ' quando o espaço dele for cadastrado completo e aprovado pelo PoolDay. Por enquanto, ainda não há valor.');
  -- Muitas contas pelo mesmo link em pouco tempo é sinal de alerta.
  if (select count(*) from public.indicacoes where indicador_id = v_ind.user_id and created_at > now() - interval '24 hours') >= 3 then
    insert into public.admin_events (event_key, kind, severity, title, detail, entity_id)
    values ('indicador-rapido:' || v_ind.user_id || ':' || to_char(now(), 'YYYYMMDD'), 'referral_self', 'review', 'Muitos cadastros pelo mesmo link em 24 horas',
      'O indicador ' || coalesce(v_ind.nome, '') || ' trouxe 3 ou mais contas em menos de 24 horas.', v_ind.user_id)
    on conflict (event_key) do nothing;
  end if;
  return 'REGISTRADA';
end;
$$;

-- 10. Avanço automático pela moderação do espaço -------------------------------------------------------
-- Espaço enviado: "em análise". Primeiro espaço aprovado: libera o valor enquanto houver vagas.
-- As vagas são contadas sob trava, então duas aprovações ao mesmo tempo não passam do limite.

create or replace function poolday_private.avancar_indicacao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_ind public.indicacoes; v_indicador public.indicadores; v_cfg public.programa_indicacao; v_pagas integer; v_motivo text; v_nome text;
begin
  if new.moderation_status = 'pending' then
    update public.indicacoes set status = 'aguardando_aprovacao', property_id = coalesce(property_id, new.id),
      aguardando_em = coalesce(aguardando_em, now()), updated_at = now()
    where anfitriao_id = new.host_id and status = 'cadastrou' returning * into v_ind;
    if found then
      select * into v_indicador from public.indicadores where user_id = v_ind.indicador_id;
      select valor_centavos into v_pagas from public.programa_indicacao;
      perform poolday_private.avisar_indicador(v_ind.indicador_id, 'indicacao-analise:' || v_ind.id, 'Espaço indicado em análise',
        'O espaço que você indicou foi enviado e está em análise. Ainda não há valor: você recebe ' || poolday_private.reais(v_pagas) || ' se ele for aprovado.');
      insert into public.admin_events (event_key, kind, severity, title, detail, entity_id)
      values ('indicado-analise:' || new.id, 'referral', 'review', 'Espaço indicado aguardando aprovação',
        'Indicado por ' || coalesce(v_indicador.nome, 'indicador') || '. Use a checklist na aba Indicações antes de aprovar.', new.id)
      on conflict (event_key) do nothing;
    end if;
    return new;
  end if;
  if new.moderation_status <> 'approved' or (tg_op = 'UPDATE' and old.moderation_status = 'approved') then return new; end if;

  select * into v_ind from public.indicacoes
  where anfitriao_id = new.host_id and status in ('cadastrou', 'aguardando_aprovacao') for update;
  if not found then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('programa_indicacao', 0));
  select * into v_cfg from public.programa_indicacao for update;
  select * into v_indicador from public.indicadores where user_id = v_ind.indicador_id;
  select count(*) into v_pagas from public.indicacoes where status in ('a_pagar', 'paga') and valor_centavos > 0;
  v_motivo := poolday_private.autoindicacao(v_ind.indicador_id, v_ind.anfitriao_id);
  select coalesce(nullif(split_part(trim(name), ' ', 1), ''), 'o anfitrião') into v_nome from public.profiles where id = v_ind.anfitriao_id;

  if v_motivo is not null then
    update public.indicacoes set status = 'recusada', recusada_em = now(), property_id = new.id, updated_at = now(),
      recusa_motivo = 'Autoindicação: ' || v_motivo || '.' where id = v_ind.id;
  elsif not coalesce(v_indicador.ativo, false) then
    update public.indicacoes set status = 'recusada', recusada_em = now(), property_id = new.id, updated_at = now(),
      recusa_motivo = 'Link do indicador bloqueado.' where id = v_ind.id;
  elsif v_cfg.ativo and v_cfg.encerrado_em is null and v_pagas < v_cfg.vagas
     or (v_cfg.encerrado_em is not null and v_ind.created_at <= v_cfg.encerrado_em and now() <= v_cfg.encerrado_em + make_interval(days => v_cfg.tolerancia_dias)) then
    update public.indicacoes set status = 'a_pagar', aprovada_em = now(), property_id = new.id, valor_centavos = v_cfg.valor_centavos, updated_at = now()
    where id = v_ind.id;
    if v_cfg.encerrado_em is null and v_pagas + 1 >= v_cfg.vagas then
      update public.programa_indicacao set encerrado_em = now(), updated_at = now();
    end if;
    perform poolday_private.avisar_indicador(v_ind.indicador_id, 'indicacao-aprovada:' || v_ind.id, 'Espaço aprovado: você vai receber',
      'O espaço de ' || v_nome || ' foi aprovado. Você recebe ' || poolday_private.reais(v_cfg.valor_centavos) || ' no Pix em até 7 dias.');
  else
    update public.indicacoes set status = 'sem_recompensa', aprovada_em = now(), property_id = new.id, valor_centavos = 0, updated_at = now(),
      recusa_motivo = 'O espaço foi aprovado depois que as vagas do programa acabaram.' where id = v_ind.id;
    perform poolday_private.avisar_indicador(v_ind.indicador_id, 'indicacao-sem-vaga:' || v_ind.id, 'Espaço aprovado, mas sem vaga',
      'O espaço de ' || v_nome || ' foi aprovado depois que as vagas do programa acabaram, por isso não há pagamento.');
  end if;
  return new;
end;
$$;

-- 11. Ações da administração (somente servidor, com auditoria) ------------------------------------------

drop function if exists public.admin_indicacao_acao(uuid, text, uuid, text, date);
create or replace function public.admin_indicacao_acao(p_actor uuid, p_acao text, p_id uuid, p_texto text, p_pago_em date default null, p_dados jsonb default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_before jsonb; v_after jsonb; v_texto text := trim(coalesce(p_texto, '')); v_ind public.indicacoes;
begin
  if not exists (select 1 from public.admin_members where user_id = p_actor) then raise exception 'FORBIDDEN'; end if;
  if char_length(v_texto) not between 5 and 500 then raise exception 'Informe a observação (5 a 500 caracteres)'; end if;

  if p_acao = 'configurar_programa' then
    select to_jsonb(c) into v_before from public.programa_indicacao c for update;
    update public.programa_indicacao set
      ativo = coalesce((p_dados->>'ativo')::boolean, ativo),
      valor_centavos = coalesce((p_dados->>'valor_centavos')::integer, valor_centavos),
      vagas = coalesce((p_dados->>'vagas')::integer, vagas),
      -- Desligar encerra o programa (com a tolerância para quem já estava em andamento). Ligar de novo reabre se houver vaga.
      encerrado_em = case
        when coalesce((p_dados->>'ativo')::boolean, ativo) = false then coalesce(encerrado_em, now())
        when (select count(*) from public.indicacoes where status in ('a_pagar', 'paga') and valor_centavos > 0) < coalesce((p_dados->>'vagas')::integer, vagas) then null
        else encerrado_em end,
      updated_at = now()
    returning to_jsonb(programa_indicacao) into v_after;
  elsif p_acao in ('marcar_indicacao_paga', 'recusar_indicacao', 'invalidar_fraude', 'registrar_verificacao') then
    select * into v_ind from public.indicacoes where id = p_id for update;
    if not found then raise exception 'Indicação não encontrada'; end if;
    v_before := to_jsonb(v_ind);
    if p_acao = 'marcar_indicacao_paga' then
      if v_ind.status <> 'a_pagar' then raise exception 'Só indicações a pagar podem ser marcadas como pagas'; end if;
      if p_pago_em is null or p_pago_em > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Data de pagamento inválida'; end if;
      update public.indicacoes set status = 'paga', paga_em = (p_pago_em::timestamp + time '12:00') at time zone 'America/Sao_Paulo',
        pagamento_observacao = v_texto, updated_at = now() where id = p_id returning to_jsonb(indicacoes) into v_after;
      perform poolday_private.avisar_indicador(v_ind.indicador_id, 'indicacao-paga:' || p_id, 'Pix pago',
        'O PoolDay pagou ' || poolday_private.reais(v_ind.valor_centavos) || ' no seu Pix pela indicação. Obrigado!');
    elsif p_acao = 'recusar_indicacao' then
      if v_ind.status = 'paga' then raise exception 'Indicação já paga: use Invalidar por fraude'; end if;
      update public.indicacoes set status = 'recusada', recusada_em = now(), recusa_motivo = v_texto, valor_centavos = 0, updated_at = now()
      where id = p_id returning to_jsonb(indicacoes) into v_after;
      perform poolday_private.avisar_indicador(v_ind.indicador_id, 'indicacao-recusada:' || p_id, 'Indicação não aprovada', 'Motivo: ' || v_texto);
    elsif p_acao = 'invalidar_fraude' then
      update public.indicacoes set status = 'recusada', recusada_em = now(), recusa_motivo = 'Fraude: ' || v_texto, valor_centavos = 0, updated_at = now()
      where id = p_id returning to_jsonb(indicacoes) into v_after;
      update public.indicadores set ativo = false, desativado_motivo = 'Fraude: ' || v_texto, updated_at = now() where user_id = v_ind.indicador_id;
    else
      if jsonb_typeof(p_dados) <> 'object' then raise exception 'Checklist inválida'; end if;
      update public.indicacoes set verificacao = p_dados || jsonb_build_object('observacao', v_texto), verificado_em = now(), verificado_por = p_actor, updated_at = now()
      where id = p_id returning to_jsonb(indicacoes) into v_after;
    end if;
  elsif p_acao in ('desativar_indicador', 'reativar_indicador') then
    select to_jsonb(r) - 'chave_pix' - 'cpf' into v_before from public.indicadores r where user_id = p_id for update;
    if v_before is null then raise exception 'Indicador não encontrado'; end if;
    update public.indicadores set ativo = p_acao = 'reativar_indicador',
      desativado_motivo = case when p_acao = 'desativar_indicador' then v_texto end, updated_at = now()
    where user_id = p_id returning to_jsonb(indicadores) - 'chave_pix' - 'cpf' into v_after;
  else
    raise exception 'Ação inválida';
  end if;
  insert into public.admin_audit (actor_id, action, entity_id, reason, before_data, after_data)
  values (p_actor, p_acao, coalesce(p_id, '00000000-0000-0000-0000-000000000000'::uuid), v_texto, v_before, v_after);
end;
$$;

-- 12. Histórico do indicador, sem dados privados do anfitrião ---------------------------------------------

drop function if exists public.minhas_indicacoes();
create or replace function public.minhas_indicacoes()
returns table (id uuid, anfitriao_primeiro_nome text, cidade text, status text, valor_centavos integer, motivo text,
  created_at timestamptz, aguardando_em timestamptz, aprovada_em timestamptz, paga_em timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, coalesce(nullif(split_part(trim(p.name), ' ', 1), ''), 'Anfitrião'), pr.city, i.status, i.valor_centavos,
    case when i.status in ('recusada', 'sem_recompensa') then i.recusa_motivo end,
    i.created_at, i.aguardando_em, i.aprovada_em, i.paga_em
  from public.indicacoes i join public.profiles p on p.id = i.anfitriao_id left join public.properties pr on pr.id = i.property_id
  where i.indicador_id = (select auth.uid())
  order by i.created_at desc;
$$;

-- 13. Permissões ---------------------------------------------------------------------------------------------

revoke all on function poolday_private.cpf_valido(text), poolday_private.cnpj_valido(text), poolday_private.pix_normalizado(text),
  poolday_private.avisar_indicador(uuid, text, text, text), poolday_private.reais(integer), poolday_private.autoindicacao(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.programa_indicacao_publico(), public.indicador_por_codigo(text),
  public.salvar_indicador(text, text, text, text, boolean, text, text, text), public.salvar_cpf_anfitriao(text),
  public.registrar_indicacao(text, timestamptz), public.minhas_indicacoes(),
  public.admin_indicacao_acao(uuid, text, uuid, text, date, jsonb) from public, anon, authenticated;
grant execute on function public.programa_indicacao_publico(), public.indicador_por_codigo(text) to anon, authenticated;
grant execute on function public.salvar_indicador(text, text, text, text, boolean, text, text, text), public.salvar_cpf_anfitriao(text),
  public.registrar_indicacao(text, timestamptz), public.minhas_indicacoes() to authenticated;
grant execute on function public.admin_indicacao_acao(uuid, text, uuid, text, date, jsonb) to service_role;
