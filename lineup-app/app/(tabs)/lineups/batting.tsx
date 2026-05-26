import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { Stack, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GenderCorner from '../../../components/GenderCorner';
import { useTeamStore } from '../../../stores/teamStore';
import { useGameStore } from '../../../stores/gameStore';
import { DEFAULT_RULES } from '../../../components/EditRulesModal';
import { supabase } from '../../../lib/supabase';
import { Player } from '../../../types/database';

const TEAM_ID = '00000000-0000-0000-0000-000000000001';

// ─── Validation ───────────────────────────────────────────────────────────────

interface ValidationResult {
  consecutiveMaleViolations: number[][];
}

function validateOrder(slots: Player[], maxConsecMen: number): ValidationResult {
  const consecutiveMaleViolations: number[][] = [];
  if (slots.length === 0) return { consecutiveMaleViolations };

  const doubled = [
    ...slots.map((p, i) => ({ player: p, index: i })),
    ...slots.map((p, i) => ({ player: p, index: i })),
  ];
  let i = 0;
  while (i < slots.length) {
    if (doubled[i].player.gender !== 'M') { i++; continue; }
    let runEnd = i;
    while (runEnd < doubled.length && doubled[runEnd].player.gender === 'M') runEnd++;
    const runLen = runEnd - i;
    if (runLen > maxConsecMen) {
      const indices = [...new Set(doubled.slice(i, runEnd).map((s) => s.index))];
      consecutiveMaleViolations.push(indices);
      i = runEnd;
    } else {
      i++;
    }
  }

  return { consecutiveMaleViolations };
}

function buildWarnings(result: ValidationResult, slots: Player[], minBatters: number): string[] {
  const warnings: string[] = [];
  if (slots.length < minBatters) {
    warnings.push(`Only ${slots.length} player${slots.length !== 1 ? 's' : ''} in roster (minimum is ${minBatters})`);
  }
  result.consecutiveMaleViolations.forEach((indices) => {
    const names = indices.map((i) => slots[i]?.name.split(' ')[0]).filter(Boolean).join(', ');
    warnings.push(`${indices.length} consecutive male batters (slots ${indices.map((i) => i + 1).join('→')}): ${names}`);
  });
  return warnings;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BattingOrderScreen() {
  const { team, players, fetchTeam } = useTeamStore();
  const { activeLineupId, selectedGame } = useGameStore();
  const rules = team?.rules;
  const maxConsecMen = rules?.max_consecutive_male_batting ?? DEFAULT_RULES.max_consecutive_male_batting;
  const minBatters   = rules?.min_players_to_play         ?? DEFAULT_RULES.min_players_to_play;
  const navigation = useNavigation();

  const [slots, setSlots] = useState<Player[]>([]);
  const [subs, setSubs] = useState<Player[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const savedSlotJson = useRef<string>('[]');
  const hasUnsavedChanges = useRef(false);
  hasUnsavedChanges.current =
    JSON.stringify(slots.map((p) => p.id)) !== savedSlotJson.current;

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!hasUnsavedChanges.current) return;
      e.preventDefault();
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes to the batting order. Leave without saving?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]
      );
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (players.length === 0) fetchTeam(TEAM_ID);
  }, []);

  useEffect(() => {
    if (selectedGame) load();
  }, [activeLineupId, selectedGame, players]);

  async function load() {
    if (!selectedGame) return;
    setLoading(true);
    try {
      // Load which players are on this game's roster
      const { data: rosterRows } = await supabase
        .from('game_roster')
        .select('player_id, is_guest')
        .eq('game_id', selectedGame.id);

      const attendingIds = new Set(
        rosterRows?.filter((r) => !r.is_guest).map((r) => r.player_id) ?? []
      );
      const subIds = rosterRows?.filter((r) => r.is_guest).map((r) => r.player_id) ?? [];

      let subPlayers: Player[] = [];
      if (subIds.length > 0) {
        const { data } = await supabase
          .from('players')
          .select('*, position_preferences(*)')
          .in('id', subIds);
        subPlayers = (data as Player[]) ?? [];
      }
      setSubs(subPlayers);

      const rosterPlayers: Player[] = [
        ...players.filter((p) => attendingIds.has(p.id)),
        ...subPlayers,
      ];

      // If a saved batting order exists, sort roster by it
      if (activeLineupId) {
        const { data: orders } = await supabase
          .from('batting_order')
          .select('order_index, player_id')
          .eq('lineup_id', activeLineupId)
          .order('order_index');

        if (orders && orders.length > 0) {
          const playerMap = new Map(rosterPlayers.map((p) => [p.id, p]));
          const ordered: Player[] = [];
          const seenIds = new Set<string>();

          orders.forEach(({ player_id }) => {
            const p = playerMap.get(player_id);
            if (p && !seenIds.has(player_id)) {
              ordered.push(p);
              seenIds.add(player_id);
            }
          });
          // Append roster players added since the order was last saved
          rosterPlayers.forEach((p) => {
            if (!seenIds.has(p.id)) ordered.push(p);
          });

          setSlots(ordered);
          savedSlotJson.current = JSON.stringify(ordered.map((p) => p.id));
          return;
        }
      }

      // No saved order — use roster order as default
      setSlots(rosterPlayers);
      savedSlotJson.current = JSON.stringify(rosterPlayers.map((p) => p.id));
    } finally {
      setLoading(false);
    }
  }

  function handleSlotPress(index: number) {
    if (selectedIndex === null) {
      setSelectedIndex(index);
      return;
    }
    if (selectedIndex === index) {
      setSelectedIndex(null);
      return;
    }
    const newSlots = [...slots];
    [newSlots[selectedIndex], newSlots[index]] = [newSlots[index], newSlots[selectedIndex]];
    setSlots(newSlots);
    setSelectedIndex(null);
  }

  async function doSave() {
    if (!activeLineupId) return;
    setSaving(true);
    try {
      await supabase.from('batting_order').delete().eq('lineup_id', activeLineupId);
      const rows = slots.map((player, i) => ({
        lineup_id: activeLineupId,
        order_index: i + 1,
        player_id: player.id,
      }));
      if (rows.length > 0) await supabase.from('batting_order').insert(rows);
      savedSlotJson.current = JSON.stringify(slots.map((p) => p.id));
      hasUnsavedChanges.current = false;
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    if (!activeLineupId) return;
    if (warnings.length === 0) { doSave(); return; }
    const warningText = warnings.map((w) => `• ${w}`).join('\n');
    Alert.alert(
      'Save Anyway?',
      `Your batting order has the following issues:\n\n${warningText}\n\nDo you want to save anyway?`,
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Save Anyway', style: 'destructive', onPress: doSave },
      ]
    );
  }

  const validation = validateOrder(slots, maxConsecMen);
  const warnings = buildWarnings(validation, slots, minBatters);
  const violatingIndices = new Set(validation.consecutiveMaleViolations.flat());

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={[]}>
      <Stack.Screen
        options={{
          title: 'Batting Order',
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !activeLineupId}
              style={{ paddingHorizontal: 4, opacity: activeLineupId ? 1 : 0.4 }}
            >
              {saving
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Save</Text>}
            </TouchableOpacity>
          ),
        }}
      />

      {/* Warning banner */}
      {warnings.length > 0 && (
        <TouchableOpacity
          onPress={() => Alert.alert('Batting Order Issues', warnings.map((w) => `• ${w}`).join('\n\n'))}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: '#FEF9C3', borderBottomWidth: 1, borderBottomColor: '#FDE68A',
            paddingHorizontal: 16, paddingVertical: 10,
          }}
        >
          <Ionicons name={'warning-outline' as any} size={18} color="#92400E" />
          <Text style={{ flex: 1, fontSize: 13, color: '#92400E', fontWeight: '500' }}>
            {warnings.length === 1 ? warnings[0] : `${warnings.length} batting order issues`}
          </Text>
          <Ionicons name={'chevron-forward' as any} size={14} color="#92400E" />
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 12 }}>
            Tap a player to select · tap another to swap
          </Text>

          {slots.map((player, index) => {
            const isSelected = selectedIndex === index;
            const isSwapTarget = selectedIndex !== null && !isSelected;
            const isViolating = violatingIndices.has(index);
            const isSub = subs.some((s) => s.id === player.id);

            return (
              <TouchableOpacity
                key={player.id}
                onPress={() => handleSlotPress(index)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
                  backgroundColor: isSelected ? '#EFF6FF' : isViolating ? '#FEFCE8' : 'white',
                  borderRadius: 12, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 12,
                  borderWidth: 1.5,
                  borderColor: isSelected ? '#3B82F6' : isSwapTarget ? '#93C5FD' : isViolating ? '#FDE68A' : '#F3F4F6',
                  ...(isSwapTarget ? { borderStyle: 'dashed' } : {}),
                }}
              >
                <GenderCorner gender={player.gender} />
                <View style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: isSelected ? '#2563EB' : isViolating ? '#FEF08A' : '#F3F4F6',
                  alignItems: 'center', justifyContent: 'center', marginRight: 12,
                }}>
                  <Text style={{
                    fontWeight: '700', fontSize: 14,
                    color: isSelected ? 'white' : isViolating ? '#854D0E' : '#6B7280',
                  }}>
                    {index + 1}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Text style={{
                    fontWeight: '600', fontSize: 16,
                    color: isSelected ? '#1D4ED8' : isViolating ? '#854D0E' : '#111827',
                  }} numberOfLines={1}>
                    {player.name}
                  </Text>
                  {isSub && (
                    <View style={{ backgroundColor: '#EDE9FE', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#7C3AED' }}>SUB</Text>
                    </View>
                  )}
                </View>

                {isViolating && !isSelected && (
                  <Ionicons name={'warning' as any} size={14} color="#CA8A04" />
                )}
                {isSelected && (
                  <Ionicons name={'swap-vertical' as any} size={16} color="#2563EB" />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
