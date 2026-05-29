import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '../../../stores/gameStore';
import { useTeamStore } from '../../../stores/teamStore';
import EditRulesModal, { DEFAULT_RULES } from '../../../components/EditRulesModal';
import { supabase } from '../../../lib/supabase';


const DEFENSIVE_COMPLETE_COUNT = 10;
const INNINGS_COUNT = 6;

type SlotStatus = 'complete' | 'partial' | 'warning' | 'empty';

function hasConsecMaleViolation(playerIds: string[], genderMap: Map<string, string>, maxConsecMen: number): boolean {
  if (playerIds.length === 0) return false;
  const genders = playerIds.map((id) => genderMap.get(id) === 'M');
  const doubled = [...genders, ...genders];
  let i = 0;
  while (i < genders.length) {
    if (!doubled[i]) { i++; continue; }
    let run = 0;
    while (i + run < doubled.length && doubled[i + run]) run++;
    if (run > maxConsecMen) return true;
    i++;
  }
  return false;
}

interface GameStatuses {
  roster: SlotStatus;
  batting: SlotStatus;
  defensive: SlotStatus;
}

export default function LineupsScreen() {
  const { games, selectedGame, activeLineupId, loading, fetchGames, selectGame } = useGameStore();
  const { team, fetchTeam, fetchTeamByOwner } = useTeamStore();
  const [gameStatuses, setGameStatuses] = useState<Record<string, GameStatuses>>({});
  const [rulesOpen, setRulesOpen] = useState(false);

  useFocusEffect(useCallback(() => { if (team?.id) fetchGames(team.id); }, [team?.id]));
  useFocusEffect(useCallback(() => { if (team?.id) fetchTeam(team.id); else fetchTeamByOwner(); }, [team?.id]));
  useFocusEffect(useCallback(() => { if (games.length > 0) fetchLineupStatuses(); }, [games]));
  useFocusEffect(useCallback(() => {
    if (games.length === 0 || selectedGame !== null) return;
    const today = new Date().toISOString().slice(0, 10);
    const nearest = games.find((g) => g.date.slice(0, 10) >= today) ?? null;
    if (nearest) selectGame(nearest);
  }, [games, selectedGame]));

  async function fetchLineupStatuses() {
    const gameIds = games.map((g) => g.id);
    const maxConsecMen  = team?.rules?.max_consecutive_male_batting ?? DEFAULT_RULES.max_consecutive_male_batting;
    const minBatters    = team?.rules?.min_players_to_play         ?? DEFAULT_RULES.min_players_to_play;
    const maxMenField   = team?.rules?.max_male_in_field            ?? DEFAULT_RULES.max_male_in_field;
    const maxField      = team?.rules?.players_in_field             ?? DEFAULT_RULES.players_in_field;

    const [{ data: lineups }, { data: rosterRows }] = await Promise.all([
      (supabase.from('lineups') as any).select('id, game_id').in('game_id', gameIds),
      (supabase.from('game_roster') as any)
        .select('game_id, players(gender, profiles(gender))')
        .in('game_id', gameIds),
    ]);

    // Build per-game attendance stats for fielder calculation
    const rosterStatsByGame = new Map<string, { total: number; women: number }>();
    (rosterRows as any[])?.forEach((r: any) => {
      if (!r.players) return;
      if (!rosterStatsByGame.has(r.game_id)) rosterStatsByGame.set(r.game_id, { total: 0, women: 0 });
      const s = rosterStatsByGame.get(r.game_id)!;
      s.total++;
      if ((r.players.profiles?.gender ?? r.players.gender) === 'F') s.women++;
    });

    function gameRosterStatus(gameId: string): SlotStatus {
      const s = rosterStatsByGame.get(gameId);
      if (!s) return 'partial'; // no roster set up yet — show nothing
      const fielders = Math.min(maxField, s.women + maxMenField, s.total);
      if (s.total < minBatters) return 'empty';   // red: too few to play
      if (fielders < maxField)  return 'warning'; // yellow: gender constraint reduces fielders
      return 'complete';                           // green: full squad
    }

    if (!lineups || (lineups as any[]).length === 0) {
      const next: Record<string, GameStatuses> = {};
      gameIds.forEach((gid) => {
        next[gid] = { roster: gameRosterStatus(gid), batting: 'empty', defensive: 'empty' };
      });
      setGameStatuses(next);
      return;
    }

    const lineupIds = (lineups as any[]).map((l: any) => l.id);

    const [{ data: battingRows }, { data: slotRows }] = await Promise.all([
      (supabase.from('batting_order') as any).select('lineup_id, order_index, player_id').in('lineup_id', lineupIds).order('order_index'),
      (supabase.from('lineup_slots') as any).select('lineup_id, inning, position, player_id').in('lineup_id', lineupIds),
    ]);

    // Fetch genders for all players referenced in batting/slots
    const playerIds = [...new Set([
      ...((battingRows as any[])?.map((r: any) => r.player_id) ?? []),
      ...((slotRows as any[])?.map((r: any) => r.player_id) ?? []),
    ])];
    const genderMap = new Map<string, string>();
    if (playerIds.length > 0) {
      const { data: playerData } = await (supabase.from('players') as any).select('id, gender, profiles(gender)').in('id', playerIds);
      (playerData as any[])?.forEach((p: any) => genderMap.set(p.id, p.profiles?.gender ?? p.gender));
    }

    const next: Record<string, GameStatuses> = {};
    (lineups as any[]).forEach(({ id: lineupId, game_id }: any) => {
      // ── Batting ────────────────────────────────────────────────────────────
      const ordered = ((battingRows as any[]) ?? [])
        .filter((r: any) => r.lineup_id === lineupId)
        .sort((a: any, b: any) => a.order_index - b.order_index);

      let batting: SlotStatus;
      if (ordered.length === 0) {
        batting = 'empty';
      } else {
        const hasError =
          ordered.length < minBatters ||
          hasConsecMaleViolation(ordered.map((r: any) => r.player_id), genderMap, maxConsecMen);
        batting = hasError ? 'warning' : 'complete';
      }

      // ── Defensive ──────────────────────────────────────────────────────────
      const slots = ((slotRows as any[]) ?? []).filter((r: any) => r.lineup_id === lineupId);

      let defensive: SlotStatus;
      if (slots.length === 0) {
        defensive = 'empty';
      } else {
        const inningMap = new Map<number, any[]>();
        slots.forEach((r: any) => {
          if (!inningMap.has(r.inning)) inningMap.set(r.inning, []);
          inningMap.get(r.inning)!.push(r);
        });

        let hasErrors = false;
        let filledInnings = 0;
        inningMap.forEach((innSlots) => {
          if (innSlots.length === DEFENSIVE_COMPLETE_COUNT) {
            filledInnings++;
            const men = innSlots.filter((s: any) => genderMap.get(s.player_id) === 'M').length;
            if (men > maxMenField) hasErrors = true;
          }
        });

        if (hasErrors) {
          defensive = 'warning';
        } else if (filledInnings === INNINGS_COUNT) {
          defensive = 'complete';
        } else {
          defensive = 'partial';
        }
      }

      next[game_id] = { roster: gameRosterStatus(game_id), batting, defensive };
    });
    setGameStatuses(next);
  }

  const hasGame = selectedGame !== null && activeLineupId !== null;
  const selectedStatuses = selectedGame ? gameStatuses[selectedGame.id] : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={[]}>
      <Stack.Screen options={{ title: 'Lineups' }} />

      {/* Game selector */}
      <View style={{ backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingVertical: 12 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#9CA3AF', paddingHorizontal: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Select Game
        </Text>
        {loading ? (
          <ActivityIndicator color="#2563EB" style={{ paddingVertical: 8 }} />
        ) : games.length === 0 ? (
          <Text style={{ fontSize: 14, color: '#9CA3AF', paddingHorizontal: 16, paddingBottom: 4 }}>
            No games scheduled — add one in Schedule tab
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {games.map((game) => {
              const isSelected = selectedGame?.id === game.id;
              const statuses = gameStatuses[game.id];
              const bothComplete = statuses?.batting === 'complete' && statuses?.defensive === 'complete';
              const today = new Date().toISOString().slice(0, 10);
              const isPast = game.date.slice(0, 10) < today;
              return (
                <TouchableOpacity
                  key={game.id}
                  onPress={() => selectGame(isSelected ? null : game)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                    paddingHorizontal: 14, paddingVertical: 8,
                    borderRadius: 20, borderWidth: 1.5,
                    borderColor: isSelected ? '#2563EB' : isPast ? '#F3F4F6' : '#E5E7EB',
                    backgroundColor: isSelected ? '#EFF6FF' : isPast ? '#F9FAFB' : 'white',
                  }}
                >
                  {bothComplete && (
                    <Ionicons name={'checkmark-circle' as any} size={14} color={isPast ? '#9CA3AF' : '#16A34A'} />
                  )}
                  <Text style={{ fontSize: 14, fontWeight: isSelected ? '700' : '500', color: isSelected ? '#1D4ED8' : isPast ? '#9CA3AF' : '#374151' }}>
                    {formatShortDate(game.date.slice(0, 10))}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Lineup cards */}
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>

        {/* Rules cogwheel */}
        <TouchableOpacity
          onPress={() => setRulesOpen(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ alignSelf: 'flex-start', padding: 4, marginBottom: -4 }}
        >
          <Ionicons name={'settings-outline' as any} size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Game Roster */}
        <TouchableOpacity
          onPress={() => hasGame && router.push('/lineups/roster')}
          activeOpacity={hasGame ? 0.7 : 1}
          style={{
            backgroundColor: 'white', borderRadius: 16, padding: 20,
            borderWidth: 1, borderColor: '#F3F4F6',
            flexDirection: 'row', alignItems: 'center', gap: 16,
            opacity: hasGame ? 1 : 0.45,
          }}
        >
          <View style={{ width: 48, height: 48, backgroundColor: '#FEF3C7', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={'people-outline' as any} size={26} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Game Roster</Text>
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
              {hasGame ? `Game on ${formatShortDate(selectedGame!.date.slice(0, 10))}` : 'Select a game above'}
            </Text>
          </View>
          <StatusIcon status={selectedStatuses?.roster} roster />
          <Ionicons name={'chevron-forward' as any} size={20} color="#D1D5DB" />
        </TouchableOpacity>

        {/* Batting Order */}
        <TouchableOpacity
          onPress={() => hasGame && router.push('/lineups/batting')}
          activeOpacity={hasGame ? 0.7 : 1}
          style={{
            backgroundColor: 'white', borderRadius: 16, padding: 20,
            borderWidth: 1, borderColor: '#F3F4F6',
            flexDirection: 'row', alignItems: 'center', gap: 16,
            opacity: hasGame ? 1 : 0.45,
          }}
        >
          <View style={{ width: 48, height: 48, backgroundColor: '#DBEAFE', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={'list-outline' as any} size={26} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Batting Order</Text>
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
              {hasGame ? `Game on ${formatShortDate(selectedGame!.date.slice(0, 10))}` : 'Select a game above'}
            </Text>
          </View>
          <StatusIcon status={selectedStatuses?.batting} />
          <Ionicons name={'chevron-forward' as any} size={20} color="#D1D5DB" />
        </TouchableOpacity>

        {/* Defensive Alignment */}
        <TouchableOpacity
          onPress={() => hasGame && router.push('/lineups/positions')}
          activeOpacity={hasGame ? 0.7 : 1}
          style={{
            backgroundColor: 'white', borderRadius: 16, padding: 20,
            borderWidth: 1, borderColor: '#F3F4F6',
            flexDirection: 'row', alignItems: 'center', gap: 16,
            opacity: hasGame ? 1 : 0.45,
          }}
        >
          <View style={{ width: 48, height: 48, backgroundColor: '#DCFCE7', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={'grid-outline' as any} size={26} color="#16A34A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Defensive Alignment</Text>
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
              {hasGame ? `Game on ${formatShortDate(selectedGame!.date.slice(0, 10))}` : 'Select a game above'}
            </Text>
          </View>
          <StatusIcon status={selectedStatuses?.defensive} />
          <Ionicons name={'chevron-forward' as any} size={20} color="#D1D5DB" />
        </TouchableOpacity>

        </View>
      </View>

      <EditRulesModal visible={rulesOpen} onClose={() => setRulesOpen(false)} />
    </SafeAreaView>
  );
}

function StatusIcon({ status, roster }: { status: SlotStatus | undefined; roster?: boolean }) {
  if (roster) {
    if (status === 'complete') return <Ionicons name={'checkmark-circle' as any} size={22} color="#16A34A" />;
    if (status === 'warning')  return <Ionicons name={'warning' as any}           size={20} color="#CA8A04" />;
    if (status === 'empty')    return <Ionicons name={'alert-circle' as any}      size={22} color="#DC2626" />;
    return null;
  }
  if (status === 'complete') return <Ionicons name={'checkmark-circle' as any} size={22} color="#16A34A" />;
  if (status === 'warning')  return <Ionicons name={'warning' as any}           size={20} color="#CA8A04" />;
  if (status === 'partial')  return <Ionicons name={'create' as any}            size={20} color="#2563EB" />;
  if (status === 'empty')    return <Ionicons name={'alert-circle' as any}      size={22} color="#DC2626" />;
  return null;
}

function formatShortDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
