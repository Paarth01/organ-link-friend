
-- Lock down SECURITY DEFINER helpers so anon cannot call them
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Tighten matches update WITH CHECK
DROP POLICY IF EXISTS "Matches: update by creator or party" ON public.matches;
CREATE POLICY "Matches: update by creator or party" ON public.matches FOR UPDATE TO authenticated
USING (
  auth.uid() = created_by
  OR EXISTS (SELECT 1 FROM public.donors d WHERE d.id = donor_id AND d.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.recipients r WHERE r.id = recipient_id AND r.user_id = auth.uid())
  OR public.has_role(auth.uid(),'admin')
)
WITH CHECK (
  auth.uid() = created_by
  OR EXISTS (SELECT 1 FROM public.donors d WHERE d.id = donor_id AND d.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.recipients r WHERE r.id = recipient_id AND r.user_id = auth.uid())
  OR public.has_role(auth.uid(),'admin')
);

-- Notifications insert: only for self, or admin
DROP POLICY IF EXISTS "Notif: insert authenticated" ON public.notifications;
CREATE POLICY "Notif: insert own or admin" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Donation history insert: keep authenticated (audit trail)
DROP POLICY IF EXISTS "History: insert authenticated" ON public.donation_history;
CREATE POLICY "History: insert by involved party or admin" ON public.donation_history FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (
    SELECT 1 FROM public.matches m
    LEFT JOIN public.donors d ON d.id = m.donor_id
    LEFT JOIN public.recipients r ON r.id = m.recipient_id
    WHERE m.id = donation_history.match_id
      AND (d.user_id = auth.uid() OR r.user_id = auth.uid() OR m.created_by = auth.uid())
  )
);
