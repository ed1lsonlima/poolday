create or replace function poolday_private.prevent_self_booking() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.client_id = new.host_id or exists (
    select 1 from public.properties p where p.id=new.property_id and p.host_id=new.client_id
  ) then
    raise exception 'RESERVA_PROPRIO_ESPACO';
  end if;
  return new;
end;
$$;
revoke all on function poolday_private.prevent_self_booking() from public, anon, authenticated;
create trigger prevent_self_booking before insert or update of client_id,host_id,property_id
on public.bookings for each row execute function poolday_private.prevent_self_booking();

