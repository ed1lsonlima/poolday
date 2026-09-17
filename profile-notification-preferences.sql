-- Preferências simples e privadas de notificações do usuário.
-- O valor padrão mantém os avisos de novas reservas ativos para anfitriões.

alter table public.profiles
  add column if not exists notification_preferences jsonb
  not null default '{"in_app_bookings": true}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_notification_preferences_object;

alter table public.profiles
  add constraint profiles_notification_preferences_object
  check (jsonb_typeof(notification_preferences) = 'object');
