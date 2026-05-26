export type Sport = 'softball' | 'kickball';
export type Preference = 'preferred' | 'avoid';
export type LineupStatus = 'draft' | 'generated' | 'approved';
export type Gender = 'M' | 'F';

export interface TeamRules {
  players_in_field: number;
  min_players_to_play: number;
  max_male_in_field: number;
  max_consecutive_male_batting: number;
  field_positions: string[];
  strategies?: Record<number, string[]>;
}

export interface Team {
  id: string;
  name: string;
  sport: Sport;
  rules: TeamRules;
  created_at: string;
}

export interface Player {
  id: string;
  team_id: string;
  name: string;
  gender: Gender;
  is_active: boolean;
  created_at: string;
  position_preferences?: PositionPreference[];
}

export interface PositionPreference {
  player_id: string;
  position: string;
  preference: Preference;
}

export interface Game {
  id: string;
  team_id: string;
  date: string;
  opponent: string | null;
  location: string | null;
  innings_count: number;
  notes: string | null;
  roster_locked: boolean;
  created_at: string;
}

export interface GameRoster {
  game_id: string;
  player_id: string;
  is_guest: boolean;
}

export interface Lineup {
  id: string;
  game_id: string;
  status: LineupStatus;
  created_at: string;
  updated_at: string;
}

export interface LineupSlot {
  id: string;
  lineup_id: string;
  inning: number;
  position: string;
  player_id: string;
}

export interface BattingOrder {
  lineup_id: string;
  order_index: number;
  player_id: string;
}

// Supabase client generic — extend as tables are added
export interface Database {
  public: {
    Tables: {
      teams: { Row: Team; Insert: Omit<Team, 'id' | 'created_at'>; Update: Partial<Team> };
      players: { Row: Player; Insert: Omit<Player, 'id' | 'created_at' | 'position_preferences'>; Update: Partial<Player> };
      position_preferences: { Row: PositionPreference; Insert: PositionPreference; Update: Partial<PositionPreference> };
      games: { Row: Game; Insert: Omit<Game, 'id' | 'created_at'>; Update: Partial<Game> };
      game_roster: { Row: GameRoster; Insert: GameRoster; Update: Partial<GameRoster> };
      lineups: { Row: Lineup; Insert: Omit<Lineup, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Lineup> };
      lineup_slots: { Row: LineupSlot; Insert: Omit<LineupSlot, 'id'>; Update: Partial<LineupSlot> };
      batting_order: { Row: BattingOrder; Insert: BattingOrder; Update: Partial<BattingOrder> };
    };
  };
}
