# Lineup Builder — Roadmap

Items are loosely prioritized within each section. Nothing here is committed or scheduled.

---

## Onboarding & Team Setup

### Shareable deep link
Captain shares a URL (e.g. `lineup.app/join/B7KP`) that drops teammates directly into the join flow without manually typing the invite code. Eliminates the biggest friction point for new member onboarding.

### Bulk roster import (text list)
A text box on the "Add Players" flow where the captain pastes one name per line to create multiple dummy/unlinked players at once. Gender and position prefs can be filled in later. Replaces the slow one-by-one add form for initial setup.

### Edit unclaimed players (by creator)
An edit button on unlinked player cards, visible only to the team captain (or whoever added the player), allowing them to update name, gender, and position preferences after the fact — without waiting for that player to claim their account.

---

## Security & Access Control

### RLS on remaining tables
`players`, `games`, `game_roster`, `lineups`, `lineup_slots`, `batting_order`, `position_preferences` currently have no row-level policies. Needs to be addressed before the join flow goes live with real users.

---

## Pending Migrations (run in Supabase dashboard)

These have been written but not yet applied:

- `20260526_add_player_user_id.sql` — adds `user_id` to players (required for claim flow)
- `20260527_add_invite_code.sql` — adds `invite_code` to teams
- `20260527_join_team_rls.sql` — opens teams SELECT to all authenticated users
- `20260527_add_team_delete_policy.sql` — allows team owners to delete their own teams
