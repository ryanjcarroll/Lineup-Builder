-- Link teams to the captain who created them
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS teams_owner_id_idx ON public.teams(owner_id);

-- Row Level Security: each user only sees their own team
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_select" ON public.teams
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "team_insert" ON public.teams
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "team_update" ON public.teams
  FOR UPDATE USING (owner_id = auth.uid());
