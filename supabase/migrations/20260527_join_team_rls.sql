-- Any authenticated user can read teams so invite code lookup works.
-- The invite code itself is the "secret" for discovery.
DROP POLICY IF EXISTS "team_select" ON public.teams;
CREATE POLICY "team_select" ON public.teams FOR SELECT TO authenticated USING (true);
