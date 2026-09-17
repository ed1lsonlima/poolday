-- Publicação segura dos anúncios: dados públicos separados de endereço e check-in.
begin;

create schema if not exists poolday_private;
revoke all on schema poolday_private from public, anon, authenticated;

alter table public.properties
  add column if not exists landmark text,
  add column if not exists map_url text;

create or replace function poolday_private.contains_external_contact(p_value text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_value, '') ~* '(@|(^|[^a-z])(instagram|insta|whats(app)?|zap|facebook|tiktok|telegram|direct|dm)([^a-z]|$)|https?://|www[.]|wa[.]me|t[.]me|[.]com([.]br)?([^a-z]|$)|([0-9][ ()+.-]*){8,})';
$$;

create or replace function poolday_private.safe_property_title(
  p_type text,
  p_city text,
  p_neighborhood text,
  p_amenities text[]
) returns text language plpgsql immutable set search_path = '' as $$
declare
  v_kind text := case p_type
    when 'pool' then 'Piscina'
    when 'chacara' then 'Chácara'
    when 'court' then 'Quadra'
    when 'soccer' then 'Campo de futebol'
    else 'Espaço para lazer'
  end;
  v_location text := concat_ws(', ', nullif(trim(p_neighborhood), ''), nullif(trim(p_city), ''));
  v_features text[] := '{}'::text[];
  v_item text;
  v_feature_text text := '';
begin
  foreach v_item in array array['Piscina','Churrasqueira','Deck','Jardim','Estacionamento','Piscina infantil','Spa','Vista mar','Área gourmet','Projetor'] loop
    if not (p_type = 'pool' and v_item = 'Piscina') and exists (
      select 1 from unnest(coalesce(p_amenities, '{}'::text[])) amenity
      where lower(trim(amenity)) = lower(v_item)
    ) then
      v_features := array_append(v_features, lower(v_item));
      exit when cardinality(v_features) = 2;
    end if;
  end loop;
  if cardinality(v_features) = 1 then v_feature_text := ' com ' || v_features[1]; end if;
  if cardinality(v_features) = 2 then v_feature_text := ' com ' || v_features[1] || ' e ' || v_features[2]; end if;
  return v_kind || v_feature_text || case when v_location <> '' then ' em ' || v_location else '' end;
end;
$$;

create or replace function poolday_private.normalize_property_public_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.amenities := array(
    select item from unnest(coalesce(new.amenities, '{}'::text[])) item
    where lower(trim(item)) <> 'churrasco'
  );
  if poolday_private.contains_external_contact(coalesce(new.description, '') || ' ' || coalesce(new.rules, '') || ' ' || array_to_string(new.amenities, ' ')) then
    raise exception 'CONTATO_EXTERNO_NAO_PERMITIDO';
  end if;
  if nullif(trim(new.map_url), '') is not null and new.map_url !~* '^https://([a-z0-9-]+[.])*(google[.][a-z.]+|goo[.]gl|waze[.]com)/' then
    raise exception 'LINK_DE_MAPA_INVALIDO';
  end if;
  new.name := poolday_private.safe_property_title(new.type, new.city, new.neighborhood, new.amenities);
  return new;
end;
$$;

drop trigger if exists a_normalize_property_public_fields on public.properties;
create trigger a_normalize_property_public_fields
before insert or update on public.properties
for each row execute function poolday_private.normalize_property_public_fields();

create table if not exists public.property_listings (
  id uuid primary key references public.properties(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  rules text,
  type text not null,
  city text not null,
  neighborhood text,
  state text,
  price_per_day numeric(10,2) not null,
  price_per_hour numeric(10,2),
  max_capacity integer not null,
  amenities text[] not null default '{}',
  images text[] not null default '{}',
  available_days integer[] not null default '{0,1,2,3,4,5,6}',
  is_active boolean not null default true,
  created_at timestamptz not null,
  hora_inicio integer,
  hora_fim integer,
  moderation_status text not null default 'approved'
);

alter table public.property_listings enable row level security;
revoke all on public.property_listings from public, anon, authenticated;
grant select on public.property_listings to anon, authenticated;
grant all on public.property_listings to service_role;
drop policy if exists "Approved listings are public" on public.property_listings;
create policy "Approved listings are public" on public.property_listings
for select to anon, authenticated using (is_active and moderation_status = 'approved');

create table if not exists public.property_access_details (
  property_id uuid primary key references public.properties(id) on delete cascade,
  name text not null,
  images text[] not null default '{}',
  city text not null,
  neighborhood text,
  address text,
  cep text,
  landmark text,
  map_url text,
  checkin_instructions text
);
alter table public.property_access_details enable row level security;
revoke all on public.property_access_details from public, anon, authenticated;
grant select on public.property_access_details to authenticated;
grant all on public.property_access_details to service_role;
drop policy if exists "Paid clients can read access details" on public.property_access_details;
create policy "Paid clients can read access details" on public.property_access_details
for select to authenticated using (exists (
  select 1 from public.bookings b
  where b.property_id = property_access_details.property_id
    and b.client_id = (select auth.uid())
    and b.status in ('confirmed', 'completed')
));

create or replace function poolday_private.sync_property_listing()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.property_access_details (
    property_id, name, images, city, neighborhood, address, cep, landmark, map_url, checkin_instructions
  ) values (
    new.id, new.name, new.images, new.city, new.neighborhood, new.address, new.cep,
    new.landmark, new.map_url, new.checkin_instructions
  ) on conflict (property_id) do update set
    name = excluded.name, images = excluded.images, city = excluded.city,
    neighborhood = excluded.neighborhood, address = excluded.address, cep = excluded.cep,
    landmark = excluded.landmark, map_url = excluded.map_url,
    checkin_instructions = excluded.checkin_instructions;
  if new.is_active and new.moderation_status = 'approved' then
    insert into public.property_listings (
      id, host_id, name, description, rules, type, city, neighborhood, state,
      price_per_day, price_per_hour, max_capacity, amenities, images,
      available_days, is_active, created_at, hora_inicio, hora_fim, moderation_status
    ) values (
      new.id, new.host_id, new.name, new.description, new.rules, new.type, new.city,
      new.neighborhood, new.state, new.price_per_day, new.price_per_hour,
      new.max_capacity, new.amenities, new.images, new.available_days, true,
      new.created_at, new.hora_inicio, new.hora_fim, 'approved'
    ) on conflict (id) do update set
      host_id = excluded.host_id, name = excluded.name, description = excluded.description,
      rules = excluded.rules, type = excluded.type, city = excluded.city,
      neighborhood = excluded.neighborhood, state = excluded.state,
      price_per_day = excluded.price_per_day, price_per_hour = excluded.price_per_hour,
      max_capacity = excluded.max_capacity, amenities = excluded.amenities,
      images = excluded.images, available_days = excluded.available_days,
      is_active = true, hora_inicio = excluded.hora_inicio, hora_fim = excluded.hora_fim,
      moderation_status = 'approved';
  else
    delete from public.property_listings where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_property_listing on public.properties;
create trigger sync_property_listing
after insert or update on public.properties
for each row execute function poolday_private.sync_property_listing();

update public.properties
set name = poolday_private.safe_property_title(type, city, neighborhood, amenities);

insert into public.property_listings (
  id, host_id, name, description, rules, type, city, neighborhood, state,
  price_per_day, price_per_hour, max_capacity, amenities, images,
  available_days, is_active, created_at, hora_inicio, hora_fim, moderation_status
)
select id, host_id, name, description, rules, type, city, neighborhood, state,
  price_per_day, price_per_hour, max_capacity, amenities, images,
  available_days, true, created_at, hora_inicio, hora_fim, moderation_status
from public.properties where is_active and moderation_status = 'approved'
on conflict (id) do update set
  name = excluded.name, description = excluded.description, rules = excluded.rules,
  city = excluded.city, neighborhood = excluded.neighborhood, state = excluded.state,
  price_per_day = excluded.price_per_day, max_capacity = excluded.max_capacity,
  amenities = excluded.amenities, images = excluded.images,
  available_days = excluded.available_days, hora_inicio = excluded.hora_inicio,
  hora_fim = excluded.hora_fim;

insert into public.property_access_details (
  property_id, name, images, city, neighborhood, address, cep, landmark, map_url, checkin_instructions
)
select id, name, images, city, neighborhood, address, cep, landmark, map_url, checkin_instructions
from public.properties
on conflict (property_id) do update set
  name = excluded.name, images = excluded.images, city = excluded.city,
  neighborhood = excluded.neighborhood, address = excluded.address, cep = excluded.cep,
  landmark = excluded.landmark, map_url = excluded.map_url,
  checkin_instructions = excluded.checkin_instructions;

drop policy if exists "Espaços ativos são públicos" on public.properties;
drop policy if exists "Owners can read private property data" on public.properties;
drop policy if exists "Confirmed clients can read booked property data" on public.properties;
revoke select on public.properties from anon;
grant select on public.properties to authenticated;
create policy "Owners can read private property data" on public.properties
for select to authenticated using ((select auth.uid()) = host_id);

create or replace function poolday_private.guard_profile_public_content()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.bio := null;
  return new;
end;
$$;
drop trigger if exists zz_guard_profile_public_content on public.profiles;
create trigger zz_guard_profile_public_content
before insert or update on public.profiles
for each row execute function poolday_private.guard_profile_public_content();

create or replace function public.sync_public_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  v_name := case when poolday_private.contains_external_contact(new.name) then
    case when new.role = 'host' then 'Anfitrião' else 'Cliente' end
    else split_part(trim(new.name), ' ', 1) end;
  insert into public.public_profiles(id,name,role,city,avatar_url,bio,verified,created_at)
  values(new.id,v_name,new.role,new.city,new.avatar_url,null,new.verified,new.created_at)
  on conflict(id) do update set name=excluded.name,role=excluded.role,city=excluded.city,
    avatar_url=excluded.avatar_url,bio=null,verified=excluded.verified;
  if TG_OP='INSERT' then
    insert into public.admin_events(kind,title,entity_id) values('signup','Novo cadastro: '||coalesce(new.name,'Usuário'),new.id);
  elsif new.role='host' and old.role<>'host' then
    insert into public.admin_events(kind,title,entity_id) values('host','Novo anfitrião',new.id);
  end if;
  return new;
end;
$$;

update public.profiles set bio = null where bio is not null;
update public.public_profiles pp set
  name = case when poolday_private.contains_external_contact(p.name) then case when p.role='host' then 'Anfitrião' else 'Cliente' end else split_part(trim(p.name), ' ', 1) end,
  bio = null
from public.profiles p where p.id = pp.id;

revoke all on function poolday_private.contains_external_contact(text),
  poolday_private.safe_property_title(text,text,text,text[]),
  poolday_private.normalize_property_public_fields(),
  poolday_private.sync_property_listing(),
  poolday_private.guard_profile_public_content()
from public, anon, authenticated;

commit;
