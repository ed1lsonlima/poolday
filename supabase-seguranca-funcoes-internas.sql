-- Funções internas não devem estar expostas pela API pública do Supabase.

ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.upsert_mp_credentials(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  SET search_path = 'public';

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificar_lead_anfitriao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_mp_credentials(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_mp_credentials(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;
