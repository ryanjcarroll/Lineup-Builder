import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '../../../stores/gameStore';
import EditRulesModal from '../../../components/EditRulesModal';
import { supabase } from '../../../lib/supabase';

const TEAM_ID = '00000000-0000-0000-0000-000000000001';

// Thresholds for "complete" — update if rules change
const BATTING_COMPLETE_COUNT = 10;     // all 10 slots filled
const DEFENSIVE_COMPLETE_COUNT = 10;   // at least 1 full inning (10 positions)

type SlotStatus = 'complete' | 'partial' | 'empty';

interface GameStatuses {
  batting: SlotStatus;
  defensive: SlotStatus;
}

export default function LineupsScreen() {
  const { games, selectedGame, activeLineupId, loading, fetchGames, selectGame } = useGameStore();
  const [gameStatuses, setGameStatuses] = useState<Record<string, GameStatuses>>({});
  const [rulesOpen, setRulesOpen] = useState(false);

  useFocusEffect(useCallback(() => { fetchGames(TEAM_ID); }, []));
  useFocusEffect(useCallback(() => { if (games.length > 0) fetchLineupStatuses(); }, [games]));
  useFocusEffect(useCallback(() => {
    if (games.length === 0 || selectedGame !== null) return;
    const today = new Date().toISOString().slice(0, 10);
    const nearest = games.find((g) => g.date.slice(0, 10) >= today) ?? null;
    if (nearest) selectGame(nearest);
  }, [games, selectedGame]));

  async function fetchLineupStatuses() {
    const { data: lineups } = await supabase
      .from('lineups')
      .select('id, game_id')
      .in('game_id', games.map((g) => g.id));

    if (!lineups || lineups.length === 0) return;

    const lineupIds = lineups.map((l) => l.id);

    const [{ data: battingRows }, { data: slotRows }] = await Promise.all([
      supabase.from('batting_order').select('lineup_id').in('lineup_id', lineupIds),
      supabase.from('lineup_slots').select('lineup_id').in('lineup_id', lineupIds),
    ]);

    const battingCount: Record<string, number> = {};
    battingRows?.forEach(({ lineup_id }) => {
      battingCount[lineup_id] = (battingCount[lineup_id] ?? 0) + 1;
    });

    const defensiveCount: Record<string, number> = {};
    slotRows?.forEach(({ lineup_id }) => {
      defensiveCount[lineup_id] = (defensiveCount[lineup_id] ?? 0) + 1;
    });

    const next: Record<string, GameStatuses> = {};
    lineups.forEach(({ id, game_id }) => {
      const b = battingCount[id] ?? 0;
      const d = defensiveCount[id] ?? 0;
      next[game_id] = {
        batting:   b >= BATTING_COMPLETE_COUNT   ? 'complete' : b > 0 ? 'partial' : 'empty',
        defensive: d >= DEFENSIVE_COMPLETE_COUNT ? 'complete' : d > 0 ? 'partial' : 'empty',
      };
    });
    setGameStatuses(next);
  }

  const hasGame = selectedGame !== null && activeLineupId !== null;
  const selectedStatuses = selectedGame ? gameStatuses[selectedGame.id] : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['bottom']}>
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
              return (
                <TouchableOpacity
                  key={game.id}
                  onPress={() => selectGame(isSelected ? null : game)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                    paddingHorizontal: 14, paddingVertical: 8,
                    borderRadius: 20, borderWidth: 1.5,
                    borderColor: isSelected ? '#2563EB' : '#E5E7EB',
                    backgroundColor: isSelected ? '#EFF6FF' : 'white',
                  }}
                >
                  {bothComplete && (
                    <Ionicons name={'checkmark-circle' as any} size={14} color="#16A34A" />
                  )}
                  <Text style={{ fontSize: 14, fontWeight: isSelected ? '700' : '500', color: isSelected ? '#1D4ED8' : '#374151' }}>
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
        {/* Rules cogwheel — left-aligned, sits just above Batting Order card */}
        <TouchableOpacity
          onPress={() => setRulesOpen(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ alignSelf: 'flex-start', padding: 4, marginBottom: -4 }}
        >
          <Ionicons name={'settings-outline' as any} size={20} color="#9CA3AF" />
        </TouchableOpacity>
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

function StatusIcon({ status }: { status: SlotStatus | undefined }) {
  if (status === 'complete') return <Ionicons name={'checkmark-circle' as any} size={22} color="#16A34A" />;
  if (status === 'partial')  return <Ionicons name={'create' as any} size={20} color="#2563EB" />;
  return null;
}

function formatShortDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
