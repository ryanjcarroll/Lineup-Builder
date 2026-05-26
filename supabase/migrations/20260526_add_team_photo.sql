-- Add photo_url to teams table (stores base64 data URL — no Storage bucket needed)
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS photo_url TEXT;
