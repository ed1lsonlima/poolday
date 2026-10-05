-- A função antiga retorna hold_expires_at e também usava esse nome sem
-- qualificação em um UPDATE; o PL/pgSQL não conseguia decidir qual deles era.
do $$
declare
  v_definition text;
  v_original text := 'coalesce(hold_expires_at,created_at+interval ''2 hours'')';
begin
  select pg_get_functiondef('public.create_booking_hold(uuid,uuid,date,integer)'::regprocedure)
  into v_definition;
  if position(v_original in v_definition)=0 then
    raise exception 'Definição de create_booking_hold mudou; revise a correção manualmente';
  end if;
  execute replace(v_definition,v_original,
    'coalesce(public.bookings.hold_expires_at,public.bookings.created_at+interval ''2 hours'')');
end;
$$;

