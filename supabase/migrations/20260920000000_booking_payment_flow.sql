-- PoolDay: pagamento 50/50, cancelamento com reembolso e notificações.
-- A criação pelo CLI foi tentada, mas o executável do Supabase não iniciou neste Windows;
-- por isso a migração foi registrada manualmente com timestamp no formato oficial.
begin;

create schema if not exists poolday_private;
revoke all on schema poolday_private from public, anon, authenticated;

alter table public.bookings
  add column if not exists payment_plan text not null default 'full',
  add column if not exists payment_state text not null default 'awaiting_first_payment',
  add column if not exists service_starts_at timestamptz,
  add column if not exists first_payment_amount numeric(10,2),
  add column if not exists balance_amount numeric(10,2) not null default 0,
  add column if not exists paid_amount numeric(10,2) not null default 0,
  add column if not exists refunded_amount numeric(10,2) not null default 0,
  add column if not exists retained_amount numeric(10,2) not null default 0,
  add column if not exists balance_due_at timestamptz,
  add column if not exists balance_payment_expires_at timestamptz,
  add column if not exists balance_payment_preference_id text,
  add column if not exists balance_payment_init_point text,
  add column if not exists deposit_payment_id text,
  add column if not exists balance_payment_id text,
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists cancelled_by text,
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_rate numeric(5,4),
  add column if not exists cancelled_at timestamptz;

alter table public.bookings drop constraint if exists bookings_payment_plan_check;
alter table public.bookings add constraint bookings_payment_plan_check check (payment_plan in ('deposit','full'));
alter table public.bookings drop constraint if exists bookings_payment_state_check;
alter table public.bookings add constraint bookings_payment_state_check check (payment_state in (
  'awaiting_first_payment','deposit_paid','awaiting_balance','fully_paid','refund_pending',
  'refunded','cancelled_with_retention','payment_expired','balance_expired'
));
alter table public.bookings drop constraint if exists bookings_cancelled_by_check;
alter table public.bookings add constraint bookings_cancelled_by_check check (cancelled_by is null or cancelled_by in ('client','host','system','admin'));

update public.bookings b set
  service_starts_at = (b.date::timestamp + make_interval(hours => coalesce(p.hora_inicio, 8))) at time zone 'America/Maceio',
  first_payment_amount = b.total_amount,
  balance_amount = 0,
  paid_amount = case when b.status in ('confirmed','completed') then b.total_amount else coalesce(b.paid_amount,0) end,
  payment_state = case when b.status in ('confirmed','completed') then 'fully_paid' when b.status='cancelled' then 'payment_expired' else b.payment_state end
from public.properties p
where p.id=b.property_id and (b.service_starts_at is null or b.first_payment_amount is null);

alter table public.bookings alter column first_payment_amount set not null;
alter table public.bookings add constraint bookings_payment_amounts_check check (
  first_payment_amount >= 0 and balance_amount >= 0 and paid_amount >= 0 and refunded_amount >= 0 and retained_amount >= 0
);

alter table public.payment_ledger
  add column if not exists payment_stage text not null default 'full',
  add column if not exists preference_id text;
alter table public.payment_ledger drop constraint if exists payment_ledger_payment_stage_check;
alter table public.payment_ledger add constraint payment_ledger_payment_stage_check check (payment_stage in ('deposit','balance','full'));

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  event_key text unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  kind text not null,
  title text not null,
  message text not null,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications for select to authenticated
  using ((select auth.uid())=user_id);
drop policy if exists "Users mark own notifications read" on public.notifications;
create policy "Users mark own notifications read" on public.notifications for update to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create or replace function poolday_private.notify_booking(
  p_event_key text, p_user_id uuid, p_booking_id uuid, p_kind text, p_title text, p_message text, p_action_url text
) returns void language sql security definer set search_path='' as $$
  insert into public.notifications(event_key,user_id,booking_id,kind,title,message,action_url)
  values(p_event_key,p_user_id,p_booking_id,p_kind,p_title,p_message,p_action_url)
  on conflict(event_key) do nothing;
$$;
revoke all on function poolday_private.notify_booking(text,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function poolday_private.notify_booking(text,uuid,uuid,text,text,text,text) to service_role;

create or replace function public.create_booking_hold(
  p_property_id uuid, p_client_id uuid, p_date date, p_guests integer
) returns table(booking_id uuid, hold_expires_at timestamptz)
language plpgsql security invoker set search_path='' as $$
declare
  v_property public.properties%rowtype;
  v_booking_id uuid;
  v_days integer := p_date-current_date;
  v_hold interval;
  v_expires timestamptz;
  v_total numeric(10,2);
  v_first numeric(10,2);
  v_plan text;
  v_start timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_property_id::text||':'||p_date::text,0));

  update public.bookings set status='cancelled',payment_state='payment_expired',cancelled_by='system',cancelled_at=now()
  where property_id=p_property_id and date=p_date and status='pending'
    and payment_state='awaiting_first_payment' and coalesce(hold_expires_at,created_at+interval '2 hours')<=now();

  update public.bookings set status='cancelled',payment_state='balance_expired',cancelled_by='system',cancelled_at=now(),retained_amount=paid_amount
  where property_id=p_property_id and date=p_date and status='pending'
    and payment_state in ('deposit_paid','awaiting_balance') and balance_payment_expires_at<=now();

  select * into v_property from public.properties where id=p_property_id and is_active=true and moderation_status='approved';
  if not found or p_date<current_date then raise exception 'ESPACO_INDISPONIVEL'; end if;
  if p_guests is not null and (p_guests<1 or p_guests>v_property.max_capacity) then raise exception 'CAPACIDADE_EXCEDIDA'; end if;
  if coalesce(array_length(v_property.available_days,1),0)>0 and not (extract(dow from p_date)::integer=any(v_property.available_days)) then raise exception 'DATA_INDISPONIVEL'; end if;
  if exists(select 1 from public.blocked_dates where property_id=p_property_id and date=p_date) then raise exception 'DATA_INDISPONIVEL'; end if;
  if exists(select 1 from public.bookings where property_id=p_property_id and date=p_date and status in ('pending','confirmed')) then raise exception 'DATA_INDISPONIVEL'; end if;

  v_total:=round(coalesce(v_property.price_per_day,v_property.price_per_hour)::numeric,2);
  if v_total is null or v_total<=0 then raise exception 'ESPACO_INDISPONIVEL'; end if;
  v_plan:=case when v_days>=8 then 'deposit' else 'full' end;
  v_first:=case when v_plan='deposit' then round(v_total/2,2) else v_total end;
  v_hold:=case when v_days>=8 then interval '24 hours' when v_days>=4 then interval '2 hours' when v_days>=1 then interval '30 minutes' else interval '15 minutes' end;
  v_expires:=now()+v_hold;
  v_start:=(p_date::timestamp+make_interval(hours=>coalesce(v_property.hora_inicio,8))) at time zone 'America/Maceio';

  insert into public.bookings(property_id,host_id,client_id,date,guests,total_amount,platform_fee,host_amount,fee_rate,status,
    hold_expires_at,payment_plan,payment_state,service_starts_at,first_payment_amount,balance_amount,balance_due_at,balance_payment_expires_at)
  values(p_property_id,v_property.host_id,p_client_id,p_date,p_guests,v_total,round(v_total*.15,2),round(v_total*.85,2),.15,'pending',
    v_expires,v_plan,'awaiting_first_payment',v_start,v_first,v_total-v_first,
    case when v_plan='deposit' then v_start-interval '72 hours' end,
    case when v_plan='deposit' then v_start-interval '48 hours' end)
  returning id into v_booking_id;

  perform poolday_private.notify_booking('hold:client:'||v_booking_id,p_client_id,v_booking_id,'payment','Data reservada temporariamente',
    'Conclua o pagamento dentro do prazo indicado para manter a data bloqueada.','/reservas');
  perform poolday_private.notify_booking('hold:host:'||v_booking_id,v_property.host_id,v_booking_id,'booking','Nova solicitação aguardando pagamento',
    'A data está bloqueada temporariamente enquanto o cliente realiza o pagamento.','/anfitriao');
  return query select v_booking_id,v_expires;
exception when unique_violation then raise exception 'DATA_INDISPONIVEL';
end;
$$;
revoke all on function public.create_booking_hold(uuid,uuid,date,integer) from public,anon,authenticated;
grant execute on function public.create_booking_hold(uuid,uuid,date,integer) to service_role;

create or replace function public.prepare_booking_installment(p_booking_id uuid,p_stage text)
returns table(payment_amount numeric,platform_fee numeric,promotion_applied boolean,payment_expires_at timestamptz,
  payment_preference_id text,payment_init_point text,payment_plan text,payment_state text)
language plpgsql security invoker set search_path='' as $$
declare b public.bookings%rowtype; v_count integer; v_promo boolean; v_amount numeric; v_fee numeric; v_exp timestamptz;
begin
  select * into b from public.bookings where id=p_booking_id for update;
  if not found or b.status<>'pending' then raise exception 'RESERVA_INDISPONIVEL'; end if;
  if b.payment_state='awaiting_first_payment' and b.hold_expires_at<=now() then raise exception 'RESERVA_INDISPONIVEL'; end if;
  if not exists(select 1 from public.properties p join public.profiles h on h.id=p.host_id join public.profiles c on c.id=b.client_id
    where p.id=b.property_id and p.is_active and p.moderation_status='approved' and h.role='host' and not h.suspended and not c.suspended)
  then raise exception 'ESPACO_INDISPONIVEL'; end if;

  if p_stage not in ('deposit','balance','full') or (b.payment_plan='full' and p_stage<>'full') or (b.payment_plan='deposit' and p_stage='full') then raise exception 'ETAPA_INVALIDA'; end if;
  if p_stage in ('deposit','full') and b.payment_state<>'awaiting_first_payment' then raise exception 'ETAPA_JA_PAGA'; end if;
  if p_stage='balance' and b.payment_state not in ('deposit_paid','awaiting_balance') then raise exception 'ETAPA_INVALIDA'; end if;
  if p_stage='balance' and b.balance_payment_expires_at<=now() then raise exception 'PRAZO_SALDO_EXPIRADO'; end if;

  perform pg_advisory_xact_lock(hashtextextended(b.host_id::text||':promocao',0));
  if b.payment_expires_at is null then
    select count(*) into v_count from public.bookings x where x.host_id=b.host_id and x.id<>b.id and x.promotion_applied
      and (
        x.status in ('confirmed','completed')
        or (x.status='pending' and (
          (x.payment_state='awaiting_first_payment' and x.hold_expires_at>now())
          or x.payment_state in ('deposit_paid','awaiting_balance','fully_paid','refund_pending')
        ))
      );
    v_promo:=b.promotion_applied or v_count<3;
    update public.bookings set fee_rate=case when v_promo then 0 else .15 end,
      platform_fee=case when v_promo then 0 else round(b.total_amount*.15,2) end,
      host_amount=case when v_promo then b.total_amount else b.total_amount-round(b.total_amount*.15,2) end,
      promotion_applied=v_promo,payment_expires_at=b.hold_expires_at where id=b.id returning * into b;
  end if;

  v_amount:=case p_stage when 'balance' then b.balance_amount else b.first_payment_amount end;
  v_fee:=round(v_amount*b.fee_rate,2);
  v_exp:=case when p_stage='balance' then b.balance_payment_expires_at else b.hold_expires_at end;
  return query select v_amount,v_fee,b.promotion_applied,v_exp,
    case when p_stage='balance' then b.balance_payment_preference_id else b.payment_preference_id end,
    case when p_stage='balance' then b.balance_payment_init_point else b.payment_init_point end,
    b.payment_plan,b.payment_state;
end;
$$;
revoke all on function public.prepare_booking_installment(uuid,text) from public,anon,authenticated;
grant execute on function public.prepare_booking_installment(uuid,text) to service_role;

create or replace function public.record_installment_payment(p_payment jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare b public.bookings%rowtype; previous public.payment_ledger%rowtype;
  v_status text:=p_payment->>'status'; v_id text:=p_payment->>'payment_id'; v_stage text:=p_payment->>'payment_stage';
  v_time timestamptz:=(p_payment->>'provider_updated_at')::timestamptz; v_amount numeric:=(p_payment->>'amount')::numeric;
  v_refund numeric:=(p_payment->>'refunded_amount')::numeric; v_expected numeric; v_paid numeric;
begin
  if v_id is null or v_id!~'^[0-9]{1,30}$' or v_stage not in ('deposit','balance','full') or v_time is null
    or p_payment->>'payment_created_at' is null or v_amount is null or v_amount<=0 or v_refund<0 or v_refund>v_amount then raise exception 'Pagamento inválido'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payment:'||v_id,0));
  select * into previous from public.payment_ledger where payment_id=v_id;
  if found and (previous.booking_id<>(p_payment->>'booking_id')::uuid or previous.amount<>v_amount or previous.payment_stage<>v_stage) then raise exception 'Identidade do pagamento divergente'; end if;
  if found and previous.provider_updated_at>=v_time then return; end if;

  select * into b from public.bookings where id=(p_payment->>'booking_id')::uuid;
  if not found then raise exception 'Reserva não encontrada'; end if;
  perform pg_advisory_xact_lock(hashtextextended(b.property_id::text||':'||b.date::text,0));
  select * into b from public.bookings where id=b.id for update;
  v_expected:=case when v_stage='balance' then b.balance_amount else b.first_payment_amount end;
  if round(v_amount,2)<>round(v_expected,2) then raise exception 'Valor do pagamento divergente'; end if;

  insert into public.payment_ledger(payment_id,booking_id,host_id,status,amount,refunded_amount,platform_fee,provider_fee,host_net,payment_created_at,provider_updated_at,payment_stage,preference_id)
  values(v_id,b.id,b.host_id,v_status,v_amount,v_refund,(p_payment->>'platform_fee')::numeric,(p_payment->>'provider_fee')::numeric,(p_payment->>'host_net')::numeric,
    (p_payment->>'payment_created_at')::timestamptz,v_time,v_stage,p_payment->>'preference_id')
  on conflict(payment_id) do update set status=excluded.status,refunded_amount=excluded.refunded_amount,platform_fee=excluded.platform_fee,
    provider_fee=excluded.provider_fee,host_net=excluded.host_net,provider_updated_at=excluded.provider_updated_at,updated_at=now();

  select coalesce(sum(amount-refunded_amount) filter(where status='approved'),0) into v_paid from public.payment_ledger where booking_id=b.id;
  update public.bookings set paid_amount=least(total_amount,v_paid) where id=b.id;

  if v_status='approved' and v_refund=0 and b.status='pending' then
    if v_stage='deposit' and b.payment_state='awaiting_first_payment' then
      update public.bookings set payment_state='deposit_paid',deposit_payment_id=v_id,payment_id=coalesce(payment_id,v_id),paid_amount=least(total_amount,v_paid) where id=b.id;
      perform poolday_private.notify_booking('deposit:client:'||v_id,b.client_id,b.id,'payment','Entrada confirmada',
        'Recebemos 50% da reserva. O restante deverá ser pago até o prazo mostrado em Minhas Reservas.','/reservas');
      perform poolday_private.notify_booking('deposit:host:'||v_id,b.host_id,b.id,'payment','Entrada da reserva confirmada',
        'A data continua bloqueada. O cliente ainda precisa pagar o saldo restante.','/anfitriao');
    elsif (v_stage='balance' and b.payment_state in ('deposit_paid','awaiting_balance')) or (v_stage='full' and b.payment_state='awaiting_first_payment') then
      update public.bookings set status='confirmed',payment_state='fully_paid',paid_amount=least(total_amount,v_paid),
        payment_id=coalesce(payment_id,v_id),balance_payment_id=case when v_stage='balance' then v_id else balance_payment_id end where id=b.id;
      perform poolday_private.notify_booking('paid:client:'||v_id,b.client_id,b.id,'payment','Reserva confirmada',
        'O pagamento total foi confirmado. O endereço e as instruções do espaço já estão disponíveis.','/reservas');
      perform poolday_private.notify_booking('paid:host:'||v_id,b.host_id,b.id,'payment','Reserva totalmente paga',
        'O pagamento foi confirmado e a diária está garantida.','/anfitriao');
    end if;
  elsif v_status='approved' and v_refund=0 and b.status<>'pending' then
    insert into public.admin_events(event_key,kind,severity,title,detail,entity_id)
    values('late-payment:'||v_id,'payment_conflict','urgent','Pagamento aprovado após encerramento da reserva',
      'Conferir pagamento e realizar eventual reembolso no Mercado Pago.',b.id) on conflict(event_key) do nothing;
  end if;

  if v_status in ('rejected','refunded','charged_back','in_mediation') or v_refund>0 then
    insert into public.admin_events(event_key,kind,severity,title,detail,entity_id)
    values('payment:'||v_id||':'||v_status||':'||v_refund,'payment',case when v_status in ('charged_back','in_mediation') then 'urgent' else 'review' end,
      'Pagamento precisa de atenção',v_status,b.id) on conflict(event_key) do nothing;
  end if;
end;
$$;
revoke all on function public.record_installment_payment(jsonb) from public,anon,authenticated;
grant execute on function public.record_installment_payment(jsonb) to service_role;

create or replace function public.prepare_booking_cancellation(p_booking_id uuid,p_actor uuid,p_reason text)
returns table(cancelled_by text,refund_amount numeric,retained_amount numeric,retention_rate numeric,paid_amount numeric,already_pending boolean)
language plpgsql security invoker set search_path='' as $$
declare b public.bookings%rowtype; v_role text; v_rate numeric:=0; v_retain numeric:=0; v_refund numeric:=0; v_pending boolean:=false;
begin
  select * into b from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'RESERVA_NAO_ENCONTRADA'; end if;
  if p_actor=b.client_id then v_role:='client'; elsif p_actor=b.host_id then v_role:='host'; else raise exception 'FORBIDDEN'; end if;
  if b.status not in ('pending','confirmed') then raise exception 'RESERVA_NAO_CANCELAVEL'; end if;
  if b.service_starts_at<=now() then raise exception 'DIARIA_INICIADA'; end if;
  if b.payment_state='refund_pending' then
    return query select coalesce(b.cancelled_by,v_role),greatest(b.paid_amount-b.retained_amount,0),b.retained_amount,coalesce(b.cancellation_rate,0),b.paid_amount,true;
    return;
  end if;
  if v_role='client' and not (now()<=b.created_at+interval '7 days' or b.service_starts_at>now()+interval '7 days') then
    v_rate:=case when b.service_starts_at>=now()+interval '72 hours' then .25 else .50 end;
  end if;
  v_retain:=least(b.paid_amount,round(b.total_amount*v_rate,2));
  v_refund:=greatest(b.paid_amount-v_retain,0);
  update public.bookings set cancellation_requested_at=now(),cancelled_by=v_role,cancellation_reason=nullif(trim(p_reason),''),
    cancellation_rate=v_rate,retained_amount=v_retain,payment_state=case when b.paid_amount>0 and v_refund>0 then 'refund_pending' when v_retain>0 then 'cancelled_with_retention' else 'refunded' end,
    status=case when b.paid_amount=0 or v_refund=0 then 'cancelled' else status end,
    cancelled_at=case when b.paid_amount=0 or v_refund=0 then now() else cancelled_at end
  where id=b.id;
  perform poolday_private.notify_booking('cancel-request:client:'||b.id,b.client_id,b.id,'cancellation','Cancelamento solicitado',
    case when v_refund>0 then 'O reembolso de R$ '||to_char(v_refund,'FM999999990D00')||' será processado pelo Mercado Pago.' else 'A reserva foi cancelada conforme a política apresentada.' end,'/reservas');
  perform poolday_private.notify_booking('cancel-request:host:'||b.id,b.host_id,b.id,'cancellation','Reserva em cancelamento',
    'A PoolDay está processando o cancelamento e os valores conforme a política.','/anfitriao');
  return query select v_role,v_refund,v_retain,v_rate,b.paid_amount,v_pending;
end;
$$;
revoke all on function public.prepare_booking_cancellation(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.prepare_booking_cancellation(uuid,uuid,text) to service_role;

create or replace function public.finalize_booking_cancellation(p_booking_id uuid,p_refunded numeric) returns void
language plpgsql security invoker set search_path='' as $$
declare b public.bookings%rowtype;
begin
  select * into b from public.bookings where id=p_booking_id for update;
  if not found or b.payment_state<>'refund_pending' then raise exception 'CANCELAMENTO_INVALIDO'; end if;
  if abs(round(p_refunded,2)-round(greatest(b.paid_amount-b.retained_amount,0),2))>.01 then raise exception 'REEMBOLSO_DIVERGENTE'; end if;
  update public.bookings set status='cancelled',payment_state=case when retained_amount>0 then 'cancelled_with_retention' else 'refunded' end,
    refunded_amount=p_refunded,cancelled_at=now() where id=b.id;
  perform poolday_private.notify_booking('cancelled:client:'||b.id,b.client_id,b.id,'refund','Reserva cancelada',
    'Reembolso processado: R$ '||to_char(p_refunded,'FM999999990D00')||'. O prazo de crédito depende do meio de pagamento.','/reservas');
  perform poolday_private.notify_booking('cancelled:host:'||b.id,b.host_id,b.id,'cancellation','Cancelamento concluído',
    case when b.retained_amount>0 then 'Valor retido conforme a política: R$ '||to_char(b.retained_amount,'FM999999990D00') else 'O cliente recebeu reembolso integral.' end,'/anfitriao');
  insert into public.admin_events(event_key,kind,title,detail,entity_id) values('cancelled:'||b.id,'booking_status','Cancelamento concluído','Reembolso: '||p_refunded||' · retenção: '||b.retained_amount,b.id) on conflict(event_key) do nothing;
end;
$$;
revoke all on function public.finalize_booking_cancellation(uuid,numeric) from public,anon,authenticated;
grant execute on function public.finalize_booking_cancellation(uuid,numeric) to service_role;

create or replace function public.get_unavailable_dates(p_property_id uuid)
returns table(unavailable_date date) language sql stable security definer set search_path='' as $$
  select d.date from public.blocked_dates d where d.property_id=p_property_id and d.date>=current_date
  union
  select b.date from public.bookings b where b.property_id=p_property_id and b.date>=current_date and (
    b.status='confirmed' or (b.status='pending' and (
      (b.payment_state='awaiting_first_payment' and b.hold_expires_at>now()) or
      b.payment_state in ('deposit_paid','awaiting_balance','refund_pending')
    ))
  );
$$;
revoke all on function public.get_unavailable_dates(uuid) from public;
grant execute on function public.get_unavailable_dates(uuid) to anon,authenticated;

commit;
