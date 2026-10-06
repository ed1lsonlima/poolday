-- Permite edição e exclusão visual de mensagens mantendo histórico privado para suporte.
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists deleted_at timestamptz;

create table if not exists public.booking_chat_message_audit (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  message_id uuid not null,
  actor_id uuid not null,
  action text not null check (action in ('edit','delete')),
  old_content text not null,
  new_content text,
  created_at timestamptz not null default now()
);
create index if not exists booking_chat_message_audit_booking_idx on public.booking_chat_message_audit(booking_id,created_at desc);
alter table public.booking_chat_message_audit enable row level security;
revoke all on public.booking_chat_message_audit from public,anon,authenticated;
grant all on public.booking_chat_message_audit to service_role;

