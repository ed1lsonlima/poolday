-- UPDATE OF não dispara quando o status é alterado pelo trigger de moderação.
drop trigger if exists notify_property_moderation on public.properties;
create trigger notify_property_moderation
after insert or update on public.properties
for each row execute function poolday_private.notify_property_moderation();
