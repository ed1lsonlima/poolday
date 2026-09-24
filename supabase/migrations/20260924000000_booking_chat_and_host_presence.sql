-- Conversas por reserva: somente API de servidor usa estas tabelas.
begin;

alter table public.properties add column if not exists host_presence text not null default 'host';
alter table public.properties drop constraint if exists properties_host_presence_check;
alter table public.properties add constraint properties_host_presence_check check (host_presence in ('host','representative','self_checkin'));
alter table public.property_listings add column if not exists host_presence text not null default 'host';
update public.property_listings l set host_presence=p.host_presence from public.properties p where p.id=l.id;

create or replace function poolday_private.sync_host_presence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.property_listings set host_presence=new.host_presence where id=new.id;
  return new;
end;
$$;
drop trigger if exists zz_sync_host_presence on public.properties;
create trigger zz_sync_host_presence after insert or update of host_presence on public.properties
for each row execute function poolday_private.sync_host_presence();

create table if not exists public.property_presence_overrides (
  property_id uuid not null references public.properties(id) on delete cascade,
  date date not null,
  presence text not null check (presence in ('host','representative','self_checkin')),
  updated_at timestamptz not null default now(),
  primary key(property_id,date)
);
alter table public.property_presence_overrides enable row level security;
revoke all on public.property_presence_overrides from public,anon,authenticated;
grant all on public.property_presence_overrides to service_role;

alter table public.bookings add column if not exists host_presence text;
alter table public.bookings drop constraint if exists bookings_host_presence_check;
alter table public.bookings add constraint bookings_host_presence_check check (host_presence is null or host_presence in ('host','representative','self_checkin'));
create or replace function poolday_private.snapshot_booking_presence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  select coalesce(o.presence,p.host_presence) into new.host_presence
  from public.properties p left join public.property_presence_overrides o
    on o.property_id=p.id and o.date=new.date where p.id=new.property_id;
  return new;
end;
$$;
drop trigger if exists snapshot_booking_presence on public.bookings;
create trigger snapshot_booking_presence before insert on public.bookings
for each row execute function poolday_private.snapshot_booking_presence();
update public.bookings b set host_presence=coalesce(
  (select o.presence from public.property_presence_overrides o where o.property_id=b.property_id and o.date=b.date),
  (select p.host_presence from public.properties p where p.id=b.property_id)
) where b.host_presence is null;

-- A primeira parcela aprovada já libera orientações de chegada.
drop policy if exists "Paid clients can read access details" on public.property_access_details;
create policy "Paid clients can read access details" on public.property_access_details
for select to authenticated using (exists (
  select 1 from public.bookings b where b.property_id=property_access_details.property_id
    and b.client_id=(select auth.uid()) and b.paid_amount>0
    and b.status in ('pending','confirmed','completed')
    and b.payment_state in ('deposit_paid','awaiting_balance','fully_paid')
));

-- Dados de contato dos perfis não são compartilhados com a outra parte da reserva.
drop policy if exists "Own profile and booking participants" on public.profiles;
create policy "Own profile only" on public.profiles for select to authenticated
using (id=(select auth.uid()));

create table if not exists public.booking_chat_acceptances (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('client','host')),
  notice_version text not null,
  accepted_at timestamptz not null default now(),
  primary key(booking_id,user_id)
);
create table if not exists public.booking_chat_reports (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id),
  reason text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.booking_chat_moderation_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  kind text not null,
  content text,
  created_at timestamptz not null default now()
);
create index if not exists booking_chat_reports_created_idx on public.booking_chat_reports(created_at desc);
create index if not exists booking_chat_moderation_created_idx on public.booking_chat_moderation_events(created_at desc);
create index if not exists messages_booking_created_idx on public.messages(booking_id,created_at,id);

alter table public.messages enable row level security;
do $$ declare item record; begin
  for item in select policyname from pg_policies where schemaname='public' and tablename='messages' loop
    execute format('drop policy %I on public.messages',item.policyname);
  end loop;
end $$;
revoke all on public.messages from public,anon,authenticated;
grant all on public.messages to service_role;
alter table public.booking_chat_acceptances enable row level security;
alter table public.booking_chat_reports enable row level security;
alter table public.booking_chat_moderation_events enable row level security;
revoke all on public.booking_chat_acceptances,public.booking_chat_reports,public.booking_chat_moderation_events from public,anon,authenticated;
grant all on public.booking_chat_acceptances,public.booking_chat_reports,public.booking_chat_moderation_events to service_role;
revoke all on function poolday_private.sync_host_presence(),poolday_private.snapshot_booking_presence() from public,anon,authenticated;

commit;

