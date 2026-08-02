-- ============================================================================
--  notificar-lead.sql
--  Cria o gatilho que avisa por e-mail quando um anfitrião novo se cadastra.
--
--  COMO USAR: cole tudo no SQL Editor do Supabase e rode.
--  A senha já está preenchida e tem que bater com o WEBHOOK_SECRET do Vercel.
--
--  O que isso faz: toda vez que uma linha entra em leads_anfitriao, o banco
--  chama a função /api/notificar-lead do site, que dispara o e-mail.
--  Como o gatilho é no banco, não depende do navegador da pessoa.
-- ============================================================================

-- Extensão que permite ao Postgres fazer chamadas HTTP.
create extension if not exists pg_net with schema extensions;

create or replace function public.notificar_lead_anfitriao()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url    text := 'https://www.pooldaybr.com/api/notificar-lead';
  v_seg    text := 'poolday-lead-9f3k2mQx7z';  -- igual ao WEBHOOK_SECRET do Vercel
begin
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type',     'application/json',
                 'x-poolday-secret', v_seg
               ),
    body    := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
exception when others then
  -- Nunca deixa a notificação derrubar o cadastro do lead.
  raise warning 'Falha ao notificar lead: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notificar_lead_anfitriao on public.leads_anfitriao;

create trigger trg_notificar_lead_anfitriao
after insert on public.leads_anfitriao
for each row
execute function public.notificar_lead_anfitriao();

-- ============================================================================
--  TESTE (opcional): insere um lead falso e deve chegar um e-mail.
--  Depois apague com o delete abaixo.
-- ============================================================================
-- insert into public.leads_anfitriao (nome, whatsapp, cidade, tipo_espaco, origem)
-- values ('Teste Notificacao', '82999999999', 'Maceio', 'Piscina', 'teste');
--
-- delete from public.leads_anfitriao where origem = 'teste';
