-- PoolDay administration. All privileged tables/RPCs are server-only.
begin;
alter table public.profiles add column if not exists suspended boolean not null default false,
  add column if not exists state text, add column if not exists municipality_code text;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,name,email,phone,city,state,municipality_code,role)
 values(new.id,coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(new.email,'@',1)),new.email,
  nullif(new.raw_user_meta_data->>'phone',''),nullif(new.raw_user_meta_data->>'city',''),
  case when new.raw_user_meta_data->>'state' ~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$' then new.raw_user_meta_data->>'state' end,
  case when new.raw_user_meta_data->>'municipality_code' ~ '^[0-9]{7}$' then new.raw_user_meta_data->>'municipality_code' end,
  case when new.raw_user_meta_data->>'role'='host' then 'host' else 'client' end)
 on conflict(id) do nothing;
 return new;
end $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
update public.profiles set city='Palmeira dos Índios',state='AL',municipality_code='2706307'
 where lower(trim(city)) in ('palmeira dos índios - alagoas','palmeira dos indios','palmeira dos índios');
update public.profiles set city='Maceió',state='AL',municipality_code='2704302'
 where lower(trim(city)) in ('maceio','maceió');
alter table public.properties add column if not exists moderation_status text not null default 'pending'
  check (moderation_status in ('pending','approved','rejected')),
  add column if not exists moderation_note text;
update public.properties set moderation_status='approved' where is_active;
alter table public.properties alter column is_active set default false;

create table public.admin_members (user_id uuid primary key references auth.users(id), created_at timestamptz not null default now());
create table public.admin_events (
 id uuid primary key default gen_random_uuid(), event_key text unique, kind text not null, severity text not null default 'info',
 title text not null, detail text, entity_id uuid, created_at timestamptz not null default now(), resolved_at timestamptz, resolved_by uuid references auth.users(id));
create table public.admin_audit (
 id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id), action text not null, entity_id uuid,
 reason text not null, before_data jsonb, after_data jsonb, created_at timestamptz not null default now());
create table public.payment_ledger (
 payment_id text primary key, booking_id uuid not null references public.bookings(id), host_id uuid not null references public.profiles(id),
 status text not null check(status in ('pending','authorized','in_process','in_mediation','approved','rejected','cancelled','refunded','charged_back')),
 amount numeric not null check(amount>0), refunded_amount numeric not null default 0 check(refunded_amount>=0 and refunded_amount<=amount),
 platform_fee numeric check(platform_fee>=0), provider_fee numeric check(provider_fee>=0),
 host_net numeric, payment_created_at timestamptz not null, provider_updated_at timestamptz not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.admin_members enable row level security;
alter table public.admin_events enable row level security;
alter table public.admin_audit enable row level security;
alter table public.payment_ledger enable row level security;
revoke all on public.admin_members,public.admin_events,public.admin_audit,public.payment_ledger from public,anon,authenticated;
grant all on public.admin_members,public.admin_events,public.admin_audit,public.payment_ledger to service_role;
create index on public.admin_events (created_at desc);
create index on public.admin_audit (created_at desc);
create index on public.payment_ledger (booking_id);
create index on public.payment_ledger (host_id);
create index on public.profiles (created_at);
create index on public.admin_events(resolved_by) where resolved_by is not null;
create index on public.admin_audit(actor_id);

insert into public.admin_members(user_id) select id from auth.users where lower(email)='silvaedilson2004@gmail.com';
do $$ begin
 if (select count(*) from public.admin_members)<>1 then raise exception 'A conta proprietária precisa existir e ser única'; end if;
end $$;
update public.profiles set role='host' where id in (select user_id from public.admin_members);

-- A valid signed JWT alone remains valid after sign-out. Require a live MFA session too.
create schema if not exists poolday_private;
revoke all on schema poolday_private from public,anon,authenticated;
grant usage on schema poolday_private to service_role;
create function poolday_private.admin_session_valid(p_user_id uuid,p_session_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select current_setting('role',true)='service_role' and exists(
  select 1 from public.admin_members m
  join auth.sessions s on s.user_id=m.user_id
  join auth.mfa_factors f on f.id=s.factor_id and f.user_id=m.user_id and f.status='verified'
  join public.profiles p on p.id=m.user_id and not p.suspended
  where m.user_id=p_user_id and s.id=p_session_id and s.aal='aal2'
   and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function poolday_private.admin_session_valid(uuid,uuid) from public,anon,authenticated;
grant execute on function poolday_private.admin_session_valid(uuid,uuid) to service_role;
create function public.admin_session_valid(p_user_id uuid,p_session_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select poolday_private.admin_session_valid(p_user_id,p_session_id);
$$;
revoke all on function public.admin_session_valid(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_session_valid(uuid,uuid) to service_role;

-- Public presentation data is separate from email, phone, payment and moderation data.
create table public.public_profiles (
 id uuid primary key references public.profiles(id) on delete cascade, name text, role text, city text,
 avatar_url text, bio text, verified boolean, created_at timestamptz);
alter table public.public_profiles enable row level security;
revoke all on public.public_profiles from public,anon,authenticated;
grant select on public.public_profiles to anon,authenticated;
grant all on public.public_profiles to service_role;
create policy "Public presentation only" on public.public_profiles for select to anon,authenticated using (true);
insert into public.public_profiles select id,name,role,city,avatar_url,bio,verified,created_at from public.profiles;
drop policy if exists "Perfis públicos" on public.profiles;
revoke select on public.profiles from anon;
create policy "Own profile and booking participants" on public.profiles for select to authenticated using (
 id=(select auth.uid()) or exists(select 1 from public.bookings b where (b.client_id=(select auth.uid()) and b.host_id=profiles.id) or (b.host_id=(select auth.uid()) and b.client_id=profiles.id)));

create or replace function public.guard_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare trusted boolean := coalesce(current_setting('role',true)='service_role' or
 (current_setting('role',true) in ('none','') and session_user in ('postgres','supabase_admin')),false);
begin
 -- current_user is the function owner in nested auth triggers, never evidence of a trusted caller.
 if not trusted then
  if TG_OP='INSERT' then new.suspended:=false; new.verified:=false; new.mp_connected:=false;
   new.created_at:=now();
  elsif new.id is distinct from old.id or new.created_at is distinct from old.created_at or new.verified is distinct from old.verified or new.mp_connected is distinct from old.mp_connected or new.suspended is distinct from old.suspended then
   raise exception 'Campos protegidos';
  end if;
  -- Profile email is never a user-editable source of identity or payment routing.
  select email into new.email from auth.users where id=new.id;
  if exists(select 1 from public.admin_members where user_id=new.id) then new.role:='host'; end if;
 end if;
 if new.state is not null and new.state !~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$' then raise exception 'UF inválida'; end if;
 if new.municipality_code is not null and new.municipality_code !~ '^[0-9]{7}$' then raise exception 'Município inválido'; end if;
 return new;
end $$;
create trigger guard_profile before insert or update on public.profiles for each row execute function public.guard_profile();

create or replace function public.sync_public_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.public_profiles(id,name,role,city,avatar_url,bio,verified,created_at)
 values(new.id,new.name,new.role,new.city,new.avatar_url,new.bio,new.verified,new.created_at)
 on conflict(id) do update set name=excluded.name,role=excluded.role,city=excluded.city,avatar_url=excluded.avatar_url,bio=excluded.bio,verified=excluded.verified;
 if TG_OP='INSERT' then
  insert into public.admin_events(kind,title,entity_id) values('signup','Novo cadastro: '||coalesce(new.name,'Usuário'),new.id);
 elsif new.role='host' and old.role<>'host' then
  insert into public.admin_events(kind,title,entity_id) values('host','Novo anfitrião',new.id);
 end if;
 return new;
end $$;
create trigger sync_public_profile after insert or update on public.profiles for each row execute function public.sync_public_profile();

create or replace function public.guard_property() returns trigger language plpgsql security definer set search_path='' as $$
declare trusted boolean := coalesce(current_setting('role',true)='service_role' or
 (current_setting('role',true) in ('none','') and session_user in ('postgres','supabase_admin')),false);
begin
 if not trusted then
  if new.host_id is distinct from auth.uid() or not exists(select 1 from public.profiles where id=new.host_id and not suspended and role='host') then raise exception 'Conta não autorizada a publicar'; end if;
  if TG_OP='INSERT' then new.moderation_status:='pending'; new.moderation_note:=null; new.is_active:=false;
  else
   if new.host_id is distinct from old.host_id or new.id is distinct from old.id or new.created_at is distinct from old.created_at or new.moderation_status is distinct from old.moderation_status or new.moderation_note is distinct from old.moderation_note then raise exception 'Campos protegidos'; end if;
   if (to_jsonb(new)-array['is_active','moderation_status','moderation_note']) is distinct from (to_jsonb(old)-array['is_active','moderation_status','moderation_note']) then
    new.moderation_status:='pending'; new.is_active:=false;
    if old.price_per_day>0 and abs(new.price_per_day-old.price_per_day)/old.price_per_day>=0.5 then
     insert into public.admin_events(kind,severity,title,detail,entity_id) values('price_change','review','Alteração de preço acima de 50%',old.price_per_day||' → '||new.price_per_day,new.id);
    end if;
   end if;
  end if;
  if new.moderation_status<>'approved' then new.is_active:=false; end if;
 end if;
 if TG_OP='INSERT' or (TG_OP='UPDATE' and new.moderation_status='pending' and old.moderation_status<>'pending') then
  insert into public.admin_events(kind,title,entity_id) values('property','Espaço aguardando aprovação: '||new.name,new.id);
 end if;
 if (TG_OP='INSERT' or new.description is distinct from old.description) and new.description ~* '(https?://|wa[.]me|@[a-z0-9_]|[0-9][ ()+.-]*[0-9][ ()+.-]*[0-9][ ()+.-]*[0-9][ ()+.-]*[0-9][ ()+.-]*[0-9][ ()+.-]*[0-9][ ()+.-]*[0-9])' then
  insert into public.admin_events(kind,severity,title,entity_id) values('contact','review','Possível contato externo no anúncio',new.id);
 end if;
 return new;
end $$;
create trigger guard_property before insert or update on public.properties for each row execute function public.guard_property();

create or replace function public.guard_booking() returns trigger language plpgsql security definer set search_path='' as $$
declare trusted boolean := coalesce(current_setting('role',true)='service_role' or
 (current_setting('role',true) in ('none','') and session_user in ('postgres','supabase_admin')),false);
begin
 if TG_OP='INSERT' then
  if not trusted then raise exception 'Use a criação segura de reservas'; end if;
  if not exists(select 1 from public.properties p join public.profiles h on h.id=p.host_id
   join public.profiles c on c.id=new.client_id where p.id=new.property_id and p.host_id=new.host_id
    and p.is_active and p.moderation_status='approved' and h.role='host' and not h.suspended and not c.suspended)
   then raise exception 'ESPACO_INDISPONIVEL'; end if;
  return new;
 end if;
 if not trusted then
  if (to_jsonb(new)-array['status','seen_by_host']) is distinct from (to_jsonb(old)-array['status','seen_by_host']) then raise exception 'Dados financeiros protegidos'; end if;
  if new.status is distinct from old.status and not (old.status='pending' and new.status='cancelled' and new.client_id=auth.uid()) then raise exception 'Somente pagamentos verificados confirmam reservas'; end if;
  if new.seen_by_host is distinct from old.seen_by_host and new.host_id is distinct from auth.uid() then raise exception 'Não autorizado'; end if;
 end if;
 return new;
end $$;
create trigger guard_booking before insert or update on public.bookings for each row execute function public.guard_booking();

-- RLS never queries profiles from bookings: that would recurse through the profile participant policy.
drop policy "Anfitriao atualiza reserva" on public.bookings;
drop policy "Cliente cancela reserva" on public.bookings;
create policy "Participants update protected booking" on public.bookings for update to authenticated
 using ((select auth.uid()) in (host_id,client_id)) with check ((select auth.uid()) in (host_id,client_id));
alter policy "Usuário edita próprio perfil" on public.profiles to authenticated
 using ((select auth.uid())=id) with check ((select auth.uid())=id);
alter policy "Anfitrião edita próprio espaço" on public.properties to authenticated
 using ((select auth.uid())=host_id) with check ((select auth.uid())=host_id);

create or replace function public.booking_admin_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
  insert into public.admin_events(kind,title,entity_id) values('booking','Nova tentativa de reserva',new.id);
 elsif new.status is distinct from old.status then
  insert into public.admin_events(kind,title,detail,entity_id) values('booking_status',case when new.status='confirmed' then 'Pagamento confirmado' when new.status='cancelled' then 'Reserva cancelada ou expirada' else 'Reserva atualizada' end,new.status,new.id);
 end if;
 return new;
end $$;
create trigger booking_admin_event after insert or update on public.bookings for each row execute function public.booking_admin_event();

-- Atomic moderation + audit, never callable directly by a browser.
create or replace function public.admin_action(p_actor uuid,p_action text,p_id uuid,p_reason text)
returns void language plpgsql security invoker set search_path='' as $$
declare v_before jsonb; v_after jsonb;
begin
 if not exists(select 1 from public.admin_members where user_id=p_actor) then raise exception 'FORBIDDEN'; end if;
 if length(trim(p_reason))<5 or length(p_reason)>1000 then raise exception 'Informe o motivo (5 a 1000 caracteres)'; end if;
 if p_action in ('approve_property','reject_property','pause_property') then
  select to_jsonb(p) into v_before from public.properties p where id=p_id for update;
  if v_before is null then raise exception 'Espaço não encontrado'; end if;
  if p_action='approve_property' and exists(select 1 from public.profiles where id=(v_before->>'host_id')::uuid and suspended) then raise exception 'Anfitrião suspenso'; end if;
  update public.properties set moderation_status=case when p_action='approve_property' then 'approved' when p_action='reject_property' then 'rejected' else moderation_status end,
   is_active=p_action='approve_property', moderation_note=p_reason where id=p_id returning to_jsonb(properties) into v_after;
 elsif p_action in ('suspend_user','restore_user','verify_user','unverify_user') then
  if exists(select 1 from public.admin_members where user_id=p_id) then raise exception 'A conta proprietária é protegida'; end if;
  select to_jsonb(p) into v_before from public.profiles p where id=p_id for update;
  if v_before is null then raise exception 'Usuário não encontrado'; end if;
  update public.profiles set suspended=case when p_action='suspend_user' then true when p_action='restore_user' then false else suspended end,
   verified=case when p_action='verify_user' then true when p_action='unverify_user' then false else verified end where id=p_id returning to_jsonb(profiles) into v_after;
  if p_action='suspend_user' then update public.properties set is_active=false where host_id=p_id; end if;
 elsif p_action='resolve_event' then
  select to_jsonb(e) into v_before from public.admin_events e where id=p_id for update;
  if v_before is null then raise exception 'Alerta não encontrado'; end if;
  update public.admin_events set resolved_at=now(),resolved_by=p_actor where id=p_id returning to_jsonb(admin_events) into v_after;
 else raise exception 'Ação inválida'; end if;
 insert into public.admin_audit(actor_id,action,entity_id,reason,before_data,after_data) values(p_actor,p_action,p_id,p_reason,v_before,v_after);
end $$;

-- One row per provider payment; timestamp protects against out-of-order retries.
create or replace function public.record_payment(p_payment jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare b public.bookings%rowtype; previous public.payment_ledger%rowtype;
 v_status text:=p_payment->>'status'; v_id text:=p_payment->>'payment_id';
 v_time timestamptz:=(p_payment->>'provider_updated_at')::timestamptz;
 v_amount numeric:=(p_payment->>'amount')::numeric;
 v_refund numeric:=(p_payment->>'refunded_amount')::numeric;
begin
 if v_id is null or v_id !~ '^[0-9]{1,30}$' or v_time is null or p_payment->>'payment_created_at' is null or v_amount is null or v_refund is null
  or v_amount<=0 or v_amount='NaN'::numeric or v_refund<0 or v_refund>v_amount then raise exception 'Pagamento inválido'; end if;
 -- Serialize even cross-booking replays of the same provider payment ID.
 perform pg_advisory_xact_lock(hashtextextended('payment:'||v_id,0));
 select * into previous from public.payment_ledger where payment_id=v_id;
 if found then
  if previous.booking_id<>(p_payment->>'booking_id')::uuid or previous.amount<>v_amount then raise exception 'Identidade do pagamento divergente'; end if;
  if previous.provider_updated_at>=v_time then return; end if;
 end if;
 select * into b from public.bookings where id=(p_payment->>'booking_id')::uuid;
 if not found then raise exception 'Reserva não encontrada'; end if;
 -- Same lock order as create_booking_hold: calendar slot before booking row.
 perform pg_advisory_xact_lock(hashtextextended(b.property_id::text||':'||b.date::text,0));
 select * into b from public.bookings where id=(p_payment->>'booking_id')::uuid for update;
 if not found then raise exception 'Reserva não encontrada'; end if;
 if round(v_amount,2)<>round(b.total_amount,2) then raise exception 'Valor do pagamento divergente'; end if;
 insert into public.payment_ledger(payment_id,booking_id,host_id,status,amount,refunded_amount,platform_fee,provider_fee,host_net,payment_created_at,provider_updated_at)
 values(v_id,b.id,b.host_id,v_status,v_amount,v_refund,(p_payment->>'platform_fee')::numeric,(p_payment->>'provider_fee')::numeric,(p_payment->>'host_net')::numeric,(p_payment->>'payment_created_at')::timestamptz,v_time)
 on conflict(payment_id) do update set status=excluded.status,refunded_amount=excluded.refunded_amount,platform_fee=excluded.platform_fee,provider_fee=excluded.provider_fee,host_net=excluded.host_net,provider_updated_at=excluded.provider_updated_at,updated_at=now();
 if v_status='approved' and v_refund=0 then
  if b.status='pending' and not exists(select 1 from public.bookings where property_id=b.property_id and date=b.date and id<>b.id and status in ('pending','confirmed')) then
   update public.bookings set status='confirmed',payment_id=v_id where id=b.id;
  elsif b.payment_id is distinct from v_id then
   insert into public.admin_events(event_key,kind,severity,title,detail,entity_id) values('late-payment:'||v_id,'payment_conflict','urgent','Pagamento requer conciliação manual','Reserva cancelada, pagamento duplicado ou data ocupada. Conferir pagamento e eventual reembolso no Mercado Pago.',b.id) on conflict(event_key) do nothing;
  end if;
 elsif (v_status in ('refunded','charged_back') or v_refund=v_amount) and b.payment_id=v_id then
  update public.bookings set status='cancelled' where id=b.id;
 end if;
 if v_status in ('rejected','refunded','charged_back','in_mediation') or (p_payment->>'refunded_amount')::numeric>0 then
  insert into public.admin_events(event_key,kind,severity,title,detail,entity_id) values('payment:'||v_id||':'||v_status||':'||coalesce(p_payment->>'refunded_amount','0'),'payment',case when v_status in ('charged_back','in_mediation') then 'urgent' else 'review' end,'Pagamento precisa de atenção',v_status,b.id) on conflict(event_key) do nothing;
 end if;
end $$;

-- Freeze checkout amounts once claimed: retries must not silently reprice an existing preference.
create or replace function public.prepare_booking_payment(p_booking_id uuid)
returns table(total_amount numeric,platform_fee numeric,host_amount numeric,promotion_applied boolean,
 hold_expires_at timestamptz,payment_init_point text,payment_expires_at timestamptz)
language plpgsql security invoker set search_path='' as $$
declare b public.bookings%rowtype; v_count integer; v_promo boolean;
begin
 select * into b from public.bookings where id=p_booking_id for update;
 if not found or b.status<>'pending' or coalesce(b.hold_expires_at,b.created_at+interval '2 hours')<=now() then raise exception 'RESERVA_INDISPONIVEL'; end if;
 if not exists(select 1 from public.properties p join public.profiles h on h.id=p.host_id
   join public.profiles c on c.id=b.client_id where p.id=b.property_id and p.is_active and p.moderation_status='approved'
    and h.role='host' and not h.suspended and not c.suspended) then raise exception 'ESPACO_INDISPONIVEL'; end if;
 perform pg_advisory_xact_lock(hashtextextended(b.host_id::text||':promocao',0));
 if b.payment_expires_at is null then
  select count(*) into v_count from public.bookings x where x.host_id=b.host_id and x.id<>b.id and x.promotion_applied
   and (x.status in ('confirmed','completed') or (x.status='pending' and x.hold_expires_at>now()));
  v_promo:=b.promotion_applied or v_count<3;
  update public.bookings set fee_rate=case when v_promo then 0 else 0.15 end,
   platform_fee=case when v_promo then 0 else round(b.total_amount*0.15,2) end,
   host_amount=case when v_promo then b.total_amount else b.total_amount-round(b.total_amount*0.15,2) end,
   promotion_applied=v_promo,payment_expires_at=b.hold_expires_at where id=b.id;
 end if;
 return query select x.total_amount,x.platform_fee,x.host_amount,x.promotion_applied,x.hold_expires_at,
  x.payment_init_point,x.payment_expires_at from public.bookings x where x.id=b.id;
end $$;

revoke all on function public.guard_profile(), public.sync_public_profile(),public.guard_property(),public.guard_booking(),public.booking_admin_event(),public.admin_action(uuid,text,uuid,text),public.record_payment(jsonb) from public,anon,authenticated;
grant execute on function public.admin_action(uuid,text,uuid,text),public.record_payment(jsonb) to service_role;
commit;
