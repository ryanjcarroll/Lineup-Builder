import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Game, Lineup } from '../types/database';

interface GameStore {
  games: Game[];
  selectedGame: Game | null;
  activeLineupId: string | null;
  loading: boolean;

  fetchGames: (teamId: string) => Promise<void>;
  addGame: (teamId: string, date: string, opts?: { opponent?: string; startTime?: string }) => Promise<void>;
  removeGame: (gameId: string) => Promise<void>;
  selectGame: (game: Game | null) => Promise<void>;
  setRosterLocked: (gameId: string, locked: boolean) => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  games: [],
  selectedGame: null,
  activeLineupId: null,
  loading: false,

  fetchGames: async (teamId: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('team_id', teamId)
        .order('date');
      if (error) throw error;
      set({ games: data ?? [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addGame: async (teamId: string, date: string, opts: { opponent?: string; startTime?: string } = {}) => {
    const { data, error } = await (supabase.from('games') as any)
      .insert({
        team_id: teamId,
        date,
        innings_count: 6,
        opponent: opts.opponent ?? null,
        start_time: opts.startTime ?? null,
      })
      .select()
      .single();
    if (error || !data) return;
    set((s) => ({ games: [...s.games, data].sort((a, b) => a.date.localeCompare(b.date)) }));
  },

  removeGame: async (gameId: string) => {
    await supabase.from('games').delete().eq('id', gameId);
    const { selectedGame } = get();
    set((s) => ({
      games: s.games.filter((g) => g.id !== gameId),
      selectedGame: selectedGame?.id === gameId ? null : selectedGame,
      activeLineupId: selectedGame?.id === gameId ? null : s.activeLineupId,
    }));
  },

  selectGame: async (game: Game | null) => {
    if (!game) {
      set({ selectedGame: null, activeLineupId: null });
      return;
    }
    set({ selectedGame: game, activeLineupId: null });

    // Find or create a lineup for this game
    const { data: existing } = await supabase
      .from('lineups')
      .select('id')
      .eq('game_id', game.id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      set({ activeLineupId: existing.id });
      return;
    }

    const { data: created, error } = await supabase
      .from('lineups')
      .insert({ game_id: game.id, status: 'draft' })
      .select('id')
      .single();

    if (!error && created) set({ activeLineupId: created.id });
  },

  setRosterLocked: async (gameId: string, locked: boolean) => {
    await (supabase.from('games') as any).update({ roster_locked: locked }).eq('id', gameId);
    set((s) => ({
      games: s.games.map((g) => g.id === gameId ? { ...g, roster_locked: locked } : g),
      selectedGame: s.selectedGame?.id === gameId ? { ...s.selectedGame, roster_locked: locked } : s.selectedGame,
    }));
  },
}));
