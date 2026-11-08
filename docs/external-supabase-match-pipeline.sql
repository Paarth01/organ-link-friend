-- LifeLink match pipeline upgrade for the project's separate Supabase database.
-- Run this once after the original LifeLink schema has been installed.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS hospital_name text;

-- Status and hospital changes must go through the atomic RPCs below.
-- Keep the existing notes edit capability for authenticated users.
REVOKE UPDATE ON TABLE public.matches FROM authenticated;
GRANT UPDATE (notes) ON TABLE public.matches TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_match(
  p_match_id uuid,
  p_hospital_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_donor public.donors%ROWTYPE;
  v_recipient public.recipients%ROWTYPE;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to confirm this match.' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(p_hospital_name), '') IS NULL THEN
    RAISE EXCEPTION 'Assign a hospital before confirming this match.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT COALESCE(
    v_match.created_by = v_actor
    OR public.has_role(v_actor, 'admin'::public.app_role)
    OR public.has_role(v_actor, 'hospital'::public.app_role),
    false
  ) THEN
    RAISE EXCEPTION 'You are not allowed to coordinate this match.' USING ERRCODE = '42501';
  END IF;

  IF v_match.status <> 'proposed' THEN
    RAISE EXCEPTION 'Only proposed matches can be confirmed.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_donor FROM public.donors WHERE id = v_match.donor_id FOR UPDATE;
  SELECT * INTO v_recipient FROM public.recipients WHERE id = v_match.recipient_id FOR UPDATE;

  IF v_donor.id IS NULL OR v_recipient.id IS NULL
    OR v_donor.status <> 'available'
    OR v_recipient.status <> 'waiting' THEN
    RAISE EXCEPTION 'The donor or recipient is no longer available.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.donors SET status = 'matched' WHERE id = v_match.donor_id;
  UPDATE public.recipients SET status = 'matched' WHERE id = v_match.recipient_id;
  UPDATE public.matches
  SET status = 'accepted', hospital_name = btrim(p_hospital_name)
  WHERE id = p_match_id;

  INSERT INTO public.notifications (user_id, title, message, link)
  SELECT DISTINCT party_id, 'Match confirmed',
    v_donor.full_name || ' → ' || v_recipient.full_name || ' confirmed at ' || btrim(p_hospital_name) || '.',
    '/matches'
  FROM unnest(ARRAY[v_match.created_by, v_donor.user_id, v_recipient.user_id]) AS parties(party_id)
  WHERE party_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_donor public.donors%ROWTYPE;
  v_recipient public.recipients%ROWTYPE;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to complete this match.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT COALESCE(
    v_match.created_by = v_actor
    OR public.has_role(v_actor, 'admin'::public.app_role)
    OR public.has_role(v_actor, 'hospital'::public.app_role),
    false
  ) THEN
    RAISE EXCEPTION 'You are not allowed to coordinate this match.' USING ERRCODE = '42501';
  END IF;

  -- A completed retry is harmless; repair a missing history row without duplicates.
  IF v_match.status = 'completed' THEN
    IF NOT EXISTS (SELECT 1 FROM public.donation_history WHERE match_id = p_match_id) THEN
      SELECT * INTO v_donor FROM public.donors WHERE id = v_match.donor_id;
      SELECT * INTO v_recipient FROM public.recipients WHERE id = v_match.recipient_id;
      INSERT INTO public.donation_history
        (match_id, donor_name, recipient_name, organ, hospital_name)
      VALUES
        (p_match_id, v_donor.full_name, v_recipient.full_name, v_donor.organ, v_match.hospital_name);
    END IF;
    RETURN;
  END IF;

  IF v_match.status <> 'accepted' THEN
    RAISE EXCEPTION 'Confirm the match before completing it.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(v_match.hospital_name), '') IS NULL THEN
    RAISE EXCEPTION 'Assign a hospital before completing this match.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_donor FROM public.donors WHERE id = v_match.donor_id FOR UPDATE;
  SELECT * INTO v_recipient FROM public.recipients WHERE id = v_match.recipient_id FOR UPDATE;

  IF v_donor.id IS NULL OR v_recipient.id IS NULL
    OR v_donor.status <> 'matched'
    OR v_recipient.status <> 'matched' THEN
    RAISE EXCEPTION 'The donor or recipient is no longer matched to this case.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.donation_history WHERE match_id = p_match_id) THEN
    INSERT INTO public.donation_history
      (match_id, donor_name, recipient_name, organ, hospital_name)
    VALUES
      (p_match_id, v_donor.full_name, v_recipient.full_name, v_donor.organ, v_match.hospital_name);
  END IF;

  UPDATE public.donors SET status = 'donated' WHERE id = v_match.donor_id;
  UPDATE public.recipients SET status = 'transplanted' WHERE id = v_match.recipient_id;
  UPDATE public.matches SET status = 'completed' WHERE id = p_match_id;

  INSERT INTO public.notifications (user_id, title, message, link)
  SELECT DISTINCT party_id, 'Transplant completed',
    v_donor.full_name || ' → ' || v_recipient.full_name || ' completed at ' || v_match.hospital_name || '.',
    '/history'
  FROM unnest(ARRAY[v_match.created_by, v_donor.user_id, v_recipient.user_id]) AS parties(party_id)
  WHERE party_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to reject this match.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT COALESCE(
    v_match.created_by = v_actor
    OR public.has_role(v_actor, 'admin'::public.app_role)
    OR public.has_role(v_actor, 'hospital'::public.app_role),
    false
  ) THEN
    RAISE EXCEPTION 'You are not allowed to coordinate this match.' USING ERRCODE = '42501';
  END IF;

  IF v_match.status <> 'proposed' THEN
    RAISE EXCEPTION 'Only proposed matches can be rejected.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.matches SET status = 'rejected' WHERE id = p_match_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_match(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_match(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_match(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_match(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_match(uuid) TO authenticated;