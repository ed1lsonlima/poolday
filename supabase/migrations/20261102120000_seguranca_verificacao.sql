-- Proteções contra burla e prazo de verificação do anfitrião.
-- Não apaga nem altera dados existentes. Não muda percentuais, taxas nem a política de cancelamento do cliente.
-- Rodar ANTES de publicar o código desta branch: o site passa a usar as colunas e funções criadas aqui.
-- O código que está no ar hoje continua funcionando depois desta migração.

-- 1. Novas colunas e tabela ----------------------------------------------------------------------

alter table public.bookings add column if not exists no_access_reported_at timestamptz;
alter table public.properties add column if not exists visit_consent_at timestamptz;

-- Separada de profiles para o prazo nunca poder ser editado pelo próprio anfitrião.
create table if not exists public.host_verifications (
  host_id uuid primary key references public.profiles(id) on delete restrict,
  due_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.host_verifications enable row level security;
revoke all on public.host_verifications from anon, authenticated;
grant select on public.host_verifications to authenticated;
grant all on public.host_verifications to service_role;
drop policy if exists "Anfitriao ve o proprio prazo" on public.host_verifications;
create policy "Anfitriao ve o proprio prazo" on public.host_verifications
  for select to authenticated using (host_id = (select auth.uid()));

-- 2. Prazo de 7 dias a partir do primeiro espaço -------------------------------------------------
-- Quem já tem espaço cadastrado não recebe prazo automático: nada muda para as contas atuais.

create or replace function poolday_private.start_host_verification()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_due timestamptz := now() + interval '7 days';
begin
  if exists(select 1 from public.properties where host_id = new.host_id and id <> new.id) then return new; end if;
  if exists(select 1 from public.profiles where id = new.host_id and verified) then return new; end if;
  insert into public.host_verifications(host_id, due_at) values (new.host_id, v_due) on conflict (host_id) do nothing;
  if found then
    perform poolday_private.notify_booking('verify:host:' || new.host_id, new.host_id, null, 'verification',
      'Importante: verifique seus documentos',
      'Envie seus documentos pelo WhatsApp do PoolDay até ' || to_char(v_due at time zone 'America/Maceio', 'DD/MM/YYYY') || '. Depois desse prazo, seu espaço para de receber novas reservas.',
      '/anfitriao');
  end if;
  return new;
end $$;
revoke all on function poolday_private.start_host_verification() from public, anon, authenticated;

drop trigger if exists start_host_verification on public.properties;
create trigger start_host_verification after insert on public.properties
  for each row execute function poolday_private.start_host_verification();

-- 3. Espaço com reserva não pode ser apagado -----------------------------------------------------
-- As reservas apagariam em cascata; um pagamento ainda não registrado sumiria sem alerta.

create or replace function poolday_private.guard_property_delete()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if exists(select 1 from public.bookings where property_id = old.id) then
    raise exception 'ESPACO_COM_RESERVAS' using errcode = '23503';
  end if;
  return old;
end $$;
revoke all on function poolday_private.guard_property_delete() from public, anon, authenticated;

drop trigger if exists guard_property_delete on public.properties;
create trigger guard_property_delete before delete on public.properties
  for each row execute function poolday_private.guard_property_delete();

-- 4. Pausar ou editar o espaço não impede o cliente de pagar o restante --------------------------
-- Única mudança: a etapa 'balance' deixa de exigir espaço ativo e aprovado.

create or replace function public.prepare_booking_installment(p_booking_id uuid, p_stage text)
returns table(payment_amount numeric, platform_fee numeric, promotion_applied boolean, payment_expires_at timestamp with time zone, payment_preference_id text, payment_init_point text, payment_plan text, payment_state text)
language plpgsql set search_path to '' as $function$
declare b public.bookings%rowtype; v_count integer; v_promo boolean; v_amount numeric; v_fee numeric; v_exp timestamptz;
begin
  select * into b from public.bookings where id=p_booking_id for update;
  if not found or b.status<>'pending' then raise exception 'RESERVA_INDISPONIVEL'; end if;
  if b.payment_state='awaiting_first_payment' and b.hold_expires_at<=now() then raise exception 'RESERVA_INDISPONIVEL'; end if;
  if not exists(select 1 from public.properties p join public.profiles h on h.id=p.host_id join public.profiles c on c.id=b.client_id
    where p.id=b.property_id and (p_stage='balance' or (p.is_active and p.moderation_status='approved')) and h.role='host' and not h.suspended and not c.suspended)
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
$function$;

-- 5. Limite de datas presas, prazo de verificação vencido ----------------------------------------
-- Mudança: as duas checagens antes de criar o bloqueio temporário. O restante é igual.

create or replace function public.create_booking_hold_v2(p_property_id uuid, p_client_id uuid, p_date date, p_guests integer, p_expected_total numeric)
returns table(booking_id uuid, hold_expires_at timestamp with time zone)
language plpgsql set search_path to '' as $function$
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
  perform pg_advisory_xact_lock(hashtextextended(p_client_id::text||':datas-presas',0));
  if (select count(*) from public.bookings x where x.client_id=p_client_id and x.status='pending'
      and x.payment_state='awaiting_first_payment' and x.hold_expires_at>now()) >= 2 then
    raise exception 'LIMITE_DATAS_PRESAS';
  end if;
  if exists(select 1 from public.properties p join public.host_verifications v on v.host_id=p.host_id join public.profiles h on h.id=p.host_id
      where p.id=p_property_id and v.due_at<=now() and not h.verified) then
    raise exception 'VERIFICACAO_PENDENTE';
  end if;

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
$function$;

-- 6. Alertas claros: devolução feita fora do PoolDay e contestação -------------------------------
-- Mudança: só o último bloco, que define título e urgência do alerta.

create or replace function public.record_installment_payment(p_payment jsonb)
returns void language plpgsql set search_path to '' as $function$
declare b public.bookings%rowtype; previous public.payment_ledger%rowtype;
  v_status text:=p_payment->>'status'; v_id text:=p_payment->>'payment_id'; v_stage text:=p_payment->>'payment_stage';
  v_time timestamptz:=(p_payment->>'provider_updated_at')::timestamptz; v_amount numeric:=(p_payment->>'amount')::numeric;
  v_refund numeric:=(p_payment->>'refunded_amount')::numeric; v_expected numeric; v_paid numeric;
  v_disputed boolean; v_external boolean;
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
    v_disputed := v_status in ('charged_back','in_mediation');
    -- Toda devolução feita pelo PoolDay passa antes por refund_pending ou cancelled.
    v_external := not v_disputed and (v_status='refunded' or v_refund>0) and b.payment_state<>'refund_pending' and b.status<>'cancelled';
    insert into public.admin_events(event_key,kind,severity,title,detail,entity_id)
    values('payment:'||v_id||':'||v_status||':'||v_refund,'payment',case when v_disputed or v_external then 'urgent' else 'review' end,
      case when v_disputed then 'Cliente contestou o pagamento' when v_external then 'Devolução feita fora do PoolDay' else 'Pagamento precisa de atenção' end,
      case when v_external then 'O valor foi devolvido direto no Mercado Pago, e a reserva continua ativa. Pode ser negociação por fora.' else v_status end,b.id) on conflict(event_key) do nothing;
  end if;
end;
$function$;

-- 7. Conta Mercado Pago não troca com reserva paga em aberto -------------------------------------
-- O reembolso precisa sair da mesma conta que recebeu. Reconectar a mesma conta continua permitido.

create or replace function public.upsert_mp_credentials(p_host_id uuid, p_mp_user_id text, p_mp_access_token text, p_mp_refresh_token text, p_mp_public_key text, p_mp_token_expires_at timestamp with time zone)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if exists(select 1 from mp_credentials c where c.host_id = p_host_id and c.mp_user_id is distinct from p_mp_user_id)
    and exists(select 1 from bookings b where b.host_id = p_host_id and b.paid_amount > 0
      and (b.payment_state = 'refund_pending' or (b.status in ('pending','confirmed') and b.date >= current_date))) then
    raise exception 'CONTA_MP_BLOQUEADA';
  end if;

  INSERT INTO mp_credentials (host_id, mp_user_id, mp_access_token, mp_refresh_token, mp_public_key, mp_token_expires_at, updated_at)
  VALUES (p_host_id, p_mp_user_id, p_mp_access_token, p_mp_refresh_token, p_mp_public_key, p_mp_token_expires_at, NOW())
  ON CONFLICT (host_id) DO UPDATE SET
    mp_user_id = EXCLUDED.mp_user_id,
    mp_access_token = EXCLUDED.mp_access_token,
    mp_refresh_token = EXCLUDED.mp_refresh_token,
    mp_public_key = EXCLUDED.mp_public_key,
    mp_token_expires_at = EXCLUDED.mp_token_expires_at,
    updated_at = NOW();

  UPDATE profiles SET mp_connected = TRUE WHERE id = p_host_id;
END;
$function$;

-- 8. Cancelamento pelo anfitrião: o reembolso vem antes de cancelar ------------------------------
-- Sem notificar ninguém até o Mercado Pago aceitar. O cancelamento feito pelo cliente não muda.

create or replace function public.begin_host_cancellation(p_booking_id uuid, p_actor uuid, p_reason text)
returns table(previous_state text, refund_amount numeric, already_pending boolean)
language plpgsql set search_path to '' as $function$
declare b public.bookings%rowtype;
begin
  select * into b from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'RESERVA_NAO_ENCONTRADA'; end if;
  if p_actor is distinct from b.host_id then raise exception 'FORBIDDEN'; end if;
  if b.status not in ('pending','confirmed') then raise exception 'RESERVA_NAO_CANCELAVEL'; end if;
  if b.service_starts_at<=now() then raise exception 'DIARIA_INICIADA'; end if;
  if b.payment_state='refund_pending' then
    return query select null::text, greatest(b.paid_amount-b.retained_amount,0), true;
    return;
  end if;
  update public.bookings set cancellation_requested_at=now(),cancelled_by='host',cancellation_reason=nullif(trim(p_reason),''),
    cancellation_rate=0,retained_amount=0,payment_state='refund_pending' where id=b.id;
  return query select b.payment_state, b.paid_amount, false;
end;
$function$;

create or replace function public.abort_host_cancellation(p_booking_id uuid, p_previous_state text)
returns void language plpgsql set search_path to '' as $function$
begin
  if p_previous_state not in ('awaiting_first_payment','deposit_paid','awaiting_balance','fully_paid') then raise exception 'ESTADO_INVALIDO'; end if;
  update public.bookings set payment_state=p_previous_state,cancelled_by=null,cancellation_requested_at=null,cancellation_reason=null,cancellation_rate=null
  where id=p_booking_id and payment_state='refund_pending' and cancelled_by='host';
  if not found then raise exception 'CANCELAMENTO_INVALIDO'; end if;
end;
$function$;

-- Pausa o espaço e registra quantas vezes o anfitrião já cancelou reserva paga.
create or replace function public.after_host_cancellation(p_booking_id uuid)
returns void language plpgsql set search_path to '' as $function$
declare b public.bookings%rowtype; v_count integer;
begin
  select * into b from public.bookings where id=p_booking_id and status='cancelled' and cancelled_by='host';
  if not found then raise exception 'CANCELAMENTO_INVALIDO'; end if;
  update public.properties set is_active=false where id=b.property_id and is_active;
  select count(*) into v_count from public.bookings where host_id=b.host_id and status='cancelled' and cancelled_by='host' and refunded_amount>0;
  perform poolday_private.notify_booking('host-cancel-paused:'||b.id,b.host_id,b.id,'cancellation','Seu espaço foi pausado',
    'Você cancelou uma reserva paga, e o espaço saiu das buscas. Cancelamentos frequentes podem suspender sua conta.','/anfitriao');
  insert into public.admin_events(event_key,kind,severity,title,detail,entity_id)
  values('host-cancel:'||b.id,'host_cancellation','review','Anfitrião cancelou reserva paga',
    v_count||' cancelamento(s) de reserva paga por este anfitrião. O espaço foi pausado. Motivo: '||coalesce(b.cancellation_reason,'não informado'),b.id)
  on conflict(event_key) do nothing;
end;
$function$;

-- 9. Botão "Não consegui entrar" -----------------------------------------------------------------
-- Vale no dia da diária e até 12h do dia seguinte. Apertar de novo não duplica o alerta.

create or replace function public.report_no_access(p_booking_id uuid, p_actor uuid)
returns timestamptz language plpgsql set search_path to '' as $function$
declare b public.bookings%rowtype; v_local timestamp := now() at time zone 'America/Maceio'; v_at timestamptz;
begin
  select * into b from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'RESERVA_NAO_ENCONTRADA'; end if;
  if p_actor is distinct from b.client_id then raise exception 'FORBIDDEN'; end if;
  if b.status<>'confirmed' or b.paid_amount<=0 then raise exception 'RESERVA_NAO_CONFIRMADA'; end if;
  if not (v_local::date=b.date or (v_local::date=b.date+1 and extract(hour from v_local)<12)) then raise exception 'FORA_DO_PRAZO'; end if;
  v_at := coalesce(b.no_access_reported_at, now());
  update public.bookings set no_access_reported_at=v_at where id=b.id;
  insert into public.admin_events(event_key,kind,severity,title,detail,entity_id)
  values('no-access:'||b.id,'payment','urgent','Cliente não conseguiu entrar no espaço',
    'Registrado às '||to_char(v_at at time zone 'America/Maceio','DD/MM/YYYY HH24:MI')||'. Fale com as duas partes e veja a conversa da reserva.',b.id)
  on conflict(event_key) do nothing;
  perform poolday_private.notify_booking('no-access:host:'||b.id,b.host_id,b.id,'booking','O cliente não conseguiu entrar',
    'O cliente avisou que não conseguiu entrar no espaço. Responda agora na conversa da reserva. A equipe PoolDay foi avisada.','/anfitriao');
  return v_at;
end;
$function$;

-- As funções novas só rodam pelo servidor, como as demais funções de reserva.
revoke all on function public.begin_host_cancellation(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.abort_host_cancellation(uuid, text) from public, anon, authenticated;
revoke all on function public.after_host_cancellation(uuid) from public, anon, authenticated;
revoke all on function public.report_no_access(uuid, uuid) from public, anon, authenticated;
grant execute on function public.begin_host_cancellation(uuid, uuid, text) to service_role;
grant execute on function public.abort_host_cancellation(uuid, text) to service_role;
grant execute on function public.after_host_cancellation(uuid) to service_role;
grant execute on function public.report_no_access(uuid, uuid) to service_role;
