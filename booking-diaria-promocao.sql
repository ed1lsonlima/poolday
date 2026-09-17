-- PoolDay — reservas por diária, bloqueio transacional e promoção das 3 primeiras reservas

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fee_rate NUMERIC(5,4) NOT NULL DEFAULT 0.15,
  ADD COLUMN IF NOT EXISTS promotion_applied BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_preference_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_init_point TEXT,
  ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ;

UPDATE public.bookings
SET hold_expires_at = created_at + INTERVAL '2 hours'
WHERE status = 'pending' AND hold_expires_at IS NULL;

ALTER TABLE public.leads_anfitriao
  ADD COLUMN IF NOT EXISTS consentimento_em TIMESTAMPTZ;

DROP INDEX IF EXISTS public.uniq_confirmed_booking;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_booking
  ON public.bookings (property_id, date)
  WHERE status IN ('pending', 'confirmed');

DROP POLICY IF EXISTS "Cliente cria reserva" ON public.bookings;

CREATE OR REPLACE FUNCTION public.create_booking_hold(
  p_property_id UUID,
  p_client_id UUID,
  p_date DATE,
  p_guests INTEGER
)
RETURNS TABLE (booking_id UUID, hold_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_property public.properties%ROWTYPE;
  v_booking_id UUID;
  v_expires_at TIMESTAMPTZ := NOW() + INTERVAL '2 hours';
  v_price NUMERIC(10,2);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_property_id::TEXT || ':' || p_date::TEXT, 0));

  UPDATE public.bookings
  SET status = 'cancelled'
  WHERE property_id = p_property_id
    AND date = p_date
    AND status = 'pending'
    AND COALESCE(hold_expires_at, created_at + INTERVAL '2 hours') <= NOW();

  SELECT * INTO v_property
  FROM public.properties
  WHERE id = p_property_id AND is_active = TRUE;

  IF NOT FOUND OR p_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'ESPACO_INDISPONIVEL';
  END IF;
  IF p_guests < 1 OR p_guests > v_property.max_capacity THEN
    RAISE EXCEPTION 'CAPACIDADE_EXCEDIDA';
  END IF;
  IF COALESCE(array_length(v_property.available_days, 1), 0) > 0
     AND NOT (EXTRACT(DOW FROM p_date)::INTEGER = ANY(v_property.available_days)) THEN
    RAISE EXCEPTION 'DATA_INDISPONIVEL';
  END IF;
  IF EXISTS (SELECT 1 FROM public.blocked_dates WHERE property_id = p_property_id AND date = p_date) THEN
    RAISE EXCEPTION 'DATA_INDISPONIVEL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE property_id = p_property_id AND date = p_date AND status IN ('pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'DATA_INDISPONIVEL';
  END IF;

  v_price := ROUND(COALESCE(v_property.price_per_day, v_property.price_per_hour)::NUMERIC, 2);
  IF v_price IS NULL OR v_price <= 0 THEN RAISE EXCEPTION 'ESPACO_INDISPONIVEL'; END IF;

  INSERT INTO public.bookings (
    property_id, host_id, client_id, date, guests, total_amount,
    platform_fee, host_amount, fee_rate, status, hold_expires_at
  ) VALUES (
    p_property_id, v_property.host_id, p_client_id, p_date, p_guests, v_price,
    ROUND(v_price * 0.15, 2), ROUND(v_price * 0.85, 2), 0.15, 'pending', v_expires_at
  ) RETURNING id INTO v_booking_id;

  RETURN QUERY SELECT v_booking_id, v_expires_at;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'DATA_INDISPONIVEL';
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_booking_payment(p_booking_id UUID)
RETURNS TABLE (
  total_amount NUMERIC,
  platform_fee NUMERIC,
  host_amount NUMERIC,
  promotion_applied BOOLEAN,
  hold_expires_at TIMESTAMPTZ,
  payment_init_point TEXT,
  payment_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_price NUMERIC(10,2);
  v_promo_count INTEGER;
  v_use_promo BOOLEAN;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_booking.status <> 'pending' OR v_booking.hold_expires_at <= NOW() THEN
    RAISE EXCEPTION 'RESERVA_INDISPONIVEL';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_booking.host_id::TEXT || ':promocao', 0));

  SELECT ROUND(COALESCE(p.price_per_day, p.price_per_hour)::NUMERIC, 2)
  INTO v_price
  FROM public.properties p
  WHERE p.id = v_booking.property_id AND p.is_active = TRUE;
  IF v_price IS NULL OR v_price <= 0 THEN RAISE EXCEPTION 'ESPACO_INDISPONIVEL'; END IF;

  SELECT COUNT(*) INTO v_promo_count
  FROM public.bookings b
  WHERE b.host_id = v_booking.host_id
    AND b.id <> v_booking.id
    AND b.promotion_applied = TRUE
    AND (b.status IN ('confirmed', 'completed') OR (b.status = 'pending' AND b.hold_expires_at > NOW()));

  v_use_promo := v_booking.promotion_applied OR v_promo_count < 3;

  UPDATE public.bookings
  SET total_amount = v_price,
      fee_rate = CASE WHEN v_use_promo THEN 0 ELSE 0.15 END,
      platform_fee = CASE WHEN v_use_promo THEN 0 ELSE ROUND(v_price * 0.15, 2) END,
      host_amount = CASE WHEN v_use_promo THEN v_price ELSE ROUND(v_price * 0.85, 2) END,
      promotion_applied = v_use_promo
  WHERE id = v_booking.id;

  RETURN QUERY
  SELECT b.total_amount, b.platform_fee, b.host_amount, b.promotion_applied,
         b.hold_expires_at, b.payment_init_point, b.payment_expires_at
  FROM public.bookings b WHERE b.id = v_booking.id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_hold(UUID, UUID, DATE, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_booking_payment(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_hold(UUID, UUID, DATE, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_booking_payment(UUID) TO service_role;

-- Busca pública segura: devolve somente IDs disponíveis, sem expor reservas.
CREATE OR REPLACE FUNCTION public.get_available_property_ids(p_date DATE)
RETURNS TABLE (property_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id
  FROM public.properties p
  WHERE p.is_active = TRUE
    AND p_date >= CURRENT_DATE
    AND (
      COALESCE(array_length(p.available_days, 1), 0) = 0
      OR EXTRACT(DOW FROM p_date)::INTEGER = ANY(p.available_days)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_dates d
      WHERE d.property_id = p.id AND d.date = p_date
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.property_id = p.id
        AND b.date = p_date
        AND (b.status = 'confirmed' OR (b.status = 'pending' AND b.hold_expires_at > NOW()))
    );
$$;

REVOKE ALL ON FUNCTION public.get_available_property_ids(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_property_ids(DATE) TO anon, authenticated;

