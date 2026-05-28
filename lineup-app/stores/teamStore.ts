import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Player, Sport, Team } from '../types/database';

const INVITE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function makeCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)];
  return code;
}

async function uniqueCode(): Promise<string> {
  for (;;) {
    const code = makeCode();
    const { data } = await (supabase.from('teams') as any).select('id').eq('invite_code', code).limit(1);
    if (!data || data.length === 0) return code;
  }
}

interface TeamStore {
  team: Team | null;
  teams: Team[];
  players: Player[];
  loading: boolean;
  error: string | null;
  fetchTeam: (teamId: string) => Promise<void>;
  fetchTeamByOwner: () => Promise<void>;
  switchTeam: (teamId: string) => Promise<void>;
  createTeam: (name: string, sport: Sport) => Promise<void>;
  ensureInviteCode: (teamId: string) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;
  resetStore: () => void;
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  team: null,
  teams: [],
  players: [],
  loading: true,
  error: null,

  resetStore: () => set({ team: null, teams: [], players: [], loading: true, error: null }),

  fetchTeam: async (teamId: string) => {
    set({ loading: true, error: null });
    try {
      const [teamResult, playersResult] = await Promise.all([
        supabase.from('teams').select('*').eq('id', teamId).single(),
        supabase
          .from('players')
          .select('*, position_preferences(*)')
          .eq('team_id', teamId)
          .eq('is_active', true)
          .order('name'),
      ]);

      if (teamResult.error) throw teamResult.error;
      if (playersResult.error) throw playersResult.error;

      set({ team: teamResult.data, players: playersResult.data ?? [], loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchTeamByOwner: async () => {
    set({ loading: true, error: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { set({ loading: false }); return; }

      // Teams I own
      const ownedResult = await (supabase.from('teams') as any)
        .select('*').eq('owner_id', user.id).order('created_at');
      if (ownedResult.error) throw ownedResult.error;
      const ownedTeams: Team[] = ownedResult.data ?? [];
      const ownedIds = new Set(ownedTeams.map((t) => t.id));

      // Teams I've joined as a player (have a player record with my user_id but don't own)
      const playerResult = await (supabase.from('players') as any)
        .select('team_id').eq('user_id', user.id);
      const joinedIds = (playerResult.error || !playerResult.data)
        ? []
        : (playerResult.data as any[])
          .map((p) => p.team_id as string)
          .filter((id) => !ownedIds.has(id));

      let joinedTeams: Team[] = [];
      if (joinedIds.length > 0) {
        const joinedResult = await (supabase.from('teams') as any)
          .select('*').in('id', joinedIds).order('created_at');
        joinedTeams = joinedResult.data ?? [];
      }

      const allTeams = [...ownedTeams, ...joinedTeams];

      if (allTeams.length === 0) {
        set({ team: null, teams: [], players: [], loading: false });
        return;
      }

      const activeTeam = allTeams[0];
      const playersResult = await (supabase.from('players') as any)
        .select('*, position_preferences(*)')
        .eq('team_id', activeTeam.id)
        .eq('is_active', true)
        .order('name');

      if (playersResult.error) throw playersResult.error;
      set({ team: activeTeam, teams: allTeams, players: playersResult.data ?? [], loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  switchTeam: async (teamId: string) => {
    const target = get().teams.find(t => t.id === teamId);
    if (!target) return;

    set({ loading: true });
    try {
      const playersResult = await supabase
        .from('players')
        .select('*, position_preferences(*)')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('name');

      if (playersResult.error) throw playersResult.error;
      set({ team: target, players: playersResult.data ?? [], loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createTeam: async (name: string, sport: Sport) => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const invite_code = await uniqueCode();
      const { data, error } = await (supabase.from('teams') as any)
        .insert({
          name,
          sport,
          owner_id: user.id,
          invite_code,
          rules: {
            players_in_field: 10,
            min_players_to_play: 6,
            max_male_in_field: 7,
            max_consecutive_male_batting: 3,
            field_positions: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'EF'],
          },
        })
        .select()
        .single();

      if (error) throw error;
      set({ team: data, teams: [...get().teams, data], players: [], loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  ensureInviteCode: async (teamId: string) => {
    const code = await uniqueCode();
    await (supabase.from('teams') as any).update({ invite_code: code }).eq('id', teamId);
    set((s) => ({
      team: s.team?.id === teamId ? { ...s.team, invite_code: code } : s.team,
      teams: s.teams.map((t) => t.id === teamId ? { ...t, invite_code: code } : t),
    }));
  },

  deleteTeam: async (teamId: string) => {
    async function must(label: string, query: Promise<{ error: any }>) {
      const { error } = await query;
      if (error) throw new Error(`deleteTeam – ${label}: ${error.message}`);
    }

    try {
      const { data: gameRows, error: gErr } = await (supabase.from('games') as any).select('id').eq('team_id', teamId);
      if (gErr) throw new Error(`deleteTeam – fetch games: ${gErr.message}`);
      const gameIds: string[] = (gameRows ?? []).map((g: any) => g.id);

      if (gameIds.length > 0) {
        const { data: lineupRows, error: lErr } = await (supabase.from('lineups') as any).select('id').in('game_id', gameIds);
        if (lErr) throw new Error(`deleteTeam – fetch lineups: ${lErr.message}`);
        const lineupIds: string[] = (lineupRows ?? []).map((l: any) => l.id);
        if (lineupIds.length > 0) {
          await must('delete batting_order', (supabase.from('batting_order') as any).delete().in('lineup_id', lineupIds));
          await must('delete lineup_slots', (supabase.from('lineup_slots') as any).delete().in('lineup_id', lineupIds));
          await must('delete lineups', (supabase.from('lineups') as any).delete().in('id', lineupIds));
        }
        await must('delete game_roster', (supabase.from('game_roster') as any).delete().in('game_id', gameIds));
        await must('delete games', (supabase.from('games') as any).delete().in('id', gameIds));
      }

      const { data: playerRows, error: pErr } = await (supabase.from('players') as any).select('id').eq('team_id', teamId);
      if (pErr) throw new Error(`deleteTeam – fetch players: ${pErr.message}`);
      const playerIds: string[] = (playerRows ?? []).map((p: any) => p.id);
      if (playerIds.length > 0) {
        await must('delete position_preferences', (supabase.from('position_preferences') as any).delete().in('player_id', playerIds));
        await must('delete players', (supabase.from('players') as any).delete().in('id', playerIds));
      }

      await must('delete team', (supabase.from('teams') as any).delete().eq('id', teamId));

      const remaining = get().teams.filter((t) => t.id !== teamId);
      if (remaining.length > 0) {
        const next = remaining[0];
        const { data: playersData } = await (supabase.from('players') as any)
          .select('*, position_preferences(*)')
          .eq('team_id', next.id)
          .eq('is_active', true)
          .order('name');
        set({ team: next, teams: remaining, players: playersData ?? [] });
      } else {
        set({ team: null, teams: [], players: [] });
      }
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },
}));
