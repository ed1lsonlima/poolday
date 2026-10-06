-- Respostas dentro da mesma conversa; a API confirma que a mensagem pertence à reserva.
alter table public.messages add column if not exists reply_to_id uuid;
alter table public.messages add constraint messages_reply_to_id_fkey
  foreign key (reply_to_id) references public.messages(id) on delete set null;
create index if not exists messages_reply_to_id_idx on public.messages(reply_to_id)
  where reply_to_id is not null;

