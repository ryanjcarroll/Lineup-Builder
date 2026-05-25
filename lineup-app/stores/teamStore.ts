import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Player, Team } from '../types/database';

interface TeamStore {
  team: Team | null;
  players: Player[];
  loading: boolean;
  error: string | null;
  fetchTeam: (teamId: string) => Promise<void>;
}

export const useTeamStore = create<TeamStore>((set) => ({
  team: null,
  players: [],
  loading: false,
  error: null,

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
}));
