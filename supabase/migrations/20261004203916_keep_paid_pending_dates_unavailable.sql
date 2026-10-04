create or replace function public.get_available_property_ids(p_date date)
returns table(property_id uuid)
language sql
stable security definer
set search_path to ''
as $function$
  select p.id
  from public.properties p
  where p.is_active = true
    and p.moderation_status = 'approved'
    and p_date >= current_date
    and (
      coalesce(array_length(p.available_days, 1), 0) = 0
      or extract(dow from p_date)::integer = any(p.available_days)
    )
    and not exists (
      select 1 from public.blocked_dates d
      where d.property_id = p.id and d.date = p_date
    )
    and not exists (
      select 1 from public.bookings b
      where b.property_id = p.id
        and b.date = p_date
        and (
          b.status = 'confirmed'
          or (
            b.status = 'pending'
            and (
              b.hold_expires_at > now()
              or b.payment_state in ('deposit_paid', 'awaiting_balance', 'fully_paid', 'refund_pending')
            )
          )
        )
    );
$function$;
