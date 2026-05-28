-- Allow team owners to delete their own teams.
-- Without this, RLS blocks DELETE and the row silently survives.
CREATE POLICY "team_delete" ON public.teams
  FOR DELETE USING (owner_id = auth.uid());
