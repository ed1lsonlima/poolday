begin;

alter table public.properties drop constraint if exists properties_minimum_daily_hours;
alter table public.properties add constraint properties_minimum_daily_hours
  check (hora_inicio is not null and hora_fim is not null and hora_inicio >= 0 and hora_fim <= 23 and hora_fim - hora_inicio >= 7);

create or replace function poolday_private.notify_property_moderation()
returns trigger
language plpgsql security definer set search_path = ''
as $function$
declare v_new_pending boolean;
begin
  if tg_op = 'INSERT' then
    v_new_pending := new.moderation_status = 'pending';
  else
    v_new_pending := new.moderation_status = 'pending' and old.moderation_status is distinct from new.moderation_status;
  end if;
  if v_new_pending then
    insert into public.notifications(user_id, kind, title, message, action_url)
    select member.user_id, 'property_review', 'Novo espaço para analisar',
      'Um anfitrião enviou "' || new.name || '". Abra a lista de espaços para revisar e decidir.',
      '/admin?tab=properties'
    from public.admin_members member;
  end if;
  if tg_op = 'INSERT' then return new; end if;
  if new.moderation_status is distinct from old.moderation_status and new.moderation_status = 'approved' then
    update public.admin_events set resolved_at = now()
    where entity_id = new.id and kind = 'property' and resolved_at is null;
    insert into public.notifications(user_id, kind, title, message, action_url)
    values (new.host_id, 'property_approved', 'Seu espaço foi aprovado!',
      'O anúncio "' || new.name || '" foi aprovado e está disponível para reservas.', '/anfitriao');
  elsif new.moderation_status is distinct from old.moderation_status and new.moderation_status = 'rejected' then
    update public.admin_events set resolved_at = now()
    where entity_id = new.id and kind = 'property' and resolved_at is null;
    insert into public.notifications(user_id, kind, title, message, action_url)
    values (new.host_id, 'property_rejected', 'Seu espaço precisa de ajustes',
      'Veja o motivo no painel do anfitrião e edite o anúncio "' || new.name || '".', '/anfitriao');
  end if;
  return new;
end;
$function$;

revoke all on function poolday_private.notify_property_moderation() from public, anon, authenticated;
drop trigger if exists notify_property_moderation on public.properties;
create trigger notify_property_moderation
after insert or update of moderation_status on public.properties
for each row execute function poolday_private.notify_property_moderation();

insert into public.notifications(event_key, user_id, kind, title, message, action_url)
select 'pending-backfill:' || p.id || ':' || member.user_id,
  member.user_id, 'property_review', 'Espaço aguardando análise',
  'O anúncio "' || p.name || '" ainda precisa ser aprovado ou rejeitado.', '/admin?tab=properties'
from public.properties p cross join public.admin_members member
where p.moderation_status = 'pending'
on conflict (event_key) do nothing;

do $block$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$block$;

commit;
