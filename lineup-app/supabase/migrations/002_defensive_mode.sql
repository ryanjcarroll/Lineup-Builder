-- Add defensive alignment mode settings to games table
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS defensive_mode text NOT NULL DEFAULT 'per_inning',
  ADD COLUMN IF NOT EXISTS defensive_group_size integer NOT NULL DEFAULT 2;
