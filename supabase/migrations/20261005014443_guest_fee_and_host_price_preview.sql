-- A promoção continua sendo 0% para o anfitrião; o cliente vê a taxa de serviço.
-- Funções v2 permitem publicar o novo checkout sem alterar reservas antigas.
begin;

alter table public.bookings
  add column if not exists guest_service_fee numeric(10,2) not null default 0,
  add column if not exists pricing_version integer not null default 1;

alter table public.bookings add constraint bookings_guest_service_fee_nonnegative
  check (guest_service_fee >= 0);

create or replace function public.create_booking_hold_v2(
  p_property_id uuid, p_client_id uuid, p_date date, p_guests integer, p_expected_total numeric
) returns table(booking_id uuid, hold_expires_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  v_hold record;
  v_booking public.bookings%rowtype;
  v_promo_count integer;
  v_promo boolean;
  v_listed numeric(10,2);
  v_total numeric(10,2);
  v_fee numeric(10,2);
  v_first numeric(10,2);
begin
  select * into v_hold from public.create_booking_hold(p_property_id,p_client_id,p_date,p_guests);
  select * into v_booking from public.bookings where id=v_hold.booking_id for update;
  perform pg_advisory_xact_lock(hashtextextended(v_booking.host_id::text||':promocao',0));

  select count(*) into v_promo_count from public.bookings x
  where x.host_id=v_booking.host_id and x.id<>v_booking.id and x.promotion_applied
    and (x.status in ('confirmed','completed') or
      (x.status='pending' and ((x.payment_state='awaiting_first_payment' and x.hold_expires_at>now())
        or x.payment_state in ('deposit_paid','awaiting_balance','fully_paid','refund_pending'))));

  v_promo := v_promo_count < 3;
  v_listed := round(v_booking.total_amount,2);
  v_fee := case when v_promo then 50.00 else round(v_listed*0.15,2) end;
  v_total := v_listed + case when v_promo then 50.00 else 0 end;
  if p_expected_total is null or round(p_expected_total,2) <> v_total then
    raise exception 'PRECO_ALTERADO';
  end if;
  v_first := case when v_booking.payment_plan='deposit' then round(v_total/2,2) else v_total end;

  update public.bookings set
    pricing_version=2,
    guest_service_fee=case when v_promo then 50.00 else 0 end,
    total_amount=v_total,
    platform_fee=v_fee,
    host_amount=v_listed-case when v_promo then 0 else v_fee end,
    fee_rate=case when v_promo then 0 else 0.15 end,
    promotion_applied=v_promo,
    first_payment_amount=v_first,
    balance_amount=v_total-v_first,
    payment_expires_at=v_booking.hold_expires_at
  where id=v_booking.id;
  return query select v_hold.booking_id,v_hold.hold_expires_at;
end;
$$;
revoke all on function public.create_booking_hold_v2(uuid,uuid,date,integer,numeric) from public,anon,authenticated;
grant execute on function public.create_booking_hold_v2(uuid,uuid,date,integer,numeric) to service_role;

create or replace function public.quote_booking_v2(p_property_id uuid)
returns table(listed_price numeric, guest_service_fee numeric, total_amount numeric, promotion_applied boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  v_property public.properties%rowtype;
  v_promo_count integer;
  v_price numeric(10,2);
  v_promo boolean;
begin
  select * into v_property from public.properties where id=p_property_id and is_active and moderation_status='approved';
  if not found then raise exception 'ESPACO_INDISPONIVEL'; end if;
  select count(*) into v_promo_count from public.bookings x
  where x.host_id=v_property.host_id and x.promotion_applied
    and (x.status in ('confirmed','completed') or
      (x.status='pending' and ((x.payment_state='awaiting_first_payment' and x.hold_expires_at>now())
        or x.payment_state in ('deposit_paid','awaiting_balance','fully_paid','refund_pending'))));
  v_promo := v_promo_count < 3;
  v_price := round(coalesce(v_property.price_per_day,v_property.price_per_hour)::numeric,2);
  return query select v_price,case when v_promo then 50.00::numeric else 0.00::numeric end,
    v_price+case when v_promo then 50.00::numeric else 0.00::numeric end,v_promo;
end;
$$;
revoke all on function public.quote_booking_v2(uuid) from public,anon,authenticated;
grant execute on function public.quote_booking_v2(uuid) to service_role;

create or replace function public.prepare_booking_installment_v2(p_booking_id uuid,p_stage text)
returns table(payment_amount numeric,platform_fee numeric,promotion_applied boolean,payment_expires_at timestamptz,
  payment_preference_id text,payment_init_point text,payment_plan text,payment_state text)
language plpgsql security invoker set search_path = '' as $$
declare
  v_prepared record;
  v_booking public.bookings%rowtype;
  v_fee numeric(10,2);
begin
  select * into v_prepared from public.prepare_booking_installment(p_booking_id,p_stage);
  select * into v_booking from public.bookings where id=p_booking_id;
  v_fee := case
    when v_booking.pricing_version<>2 then v_prepared.platform_fee
    when p_stage='balance' then v_booking.platform_fee-round(v_booking.platform_fee*v_booking.first_payment_amount/v_booking.total_amount,2)
    when p_stage='deposit' then round(v_booking.platform_fee*v_booking.first_payment_amount/v_booking.total_amount,2)
    else v_booking.platform_fee
  end;
  return query select v_prepared.payment_amount,v_fee,v_prepared.promotion_applied,v_prepared.payment_expires_at,
    v_prepared.payment_preference_id,v_prepared.payment_init_point,v_prepared.payment_plan,v_prepared.payment_state;
end;
$$;
revoke all on function public.prepare_booking_installment_v2(uuid,text) from public,anon,authenticated;
grant execute on function public.prepare_booking_installment_v2(uuid,text) to service_role;

commit;

