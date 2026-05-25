import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTeamStore } from '../stores/teamStore';
import { supabase } from '../lib/supabase';
import { Player } from '../types/database';

const TEAM_ID = '00000000-0000-0000-0000-000000000001';
const LINEUP_ID = '30000000-0000-0000-0000-000000000001';
const INNINGS_COUNT = 6;

const BUTTON_W = 70;
const BUTTON_H = 48;
const CONTAINER_H = 340;
const HORIZONTAL_MARGIN = 32; // mx-4 on each side

// cx/cy are center-point percentages of the container dimensions
const FIELD_POSITIONS = [
  { key: 'LF', cx: 11, cy: 13 },
  { key: 'LC', cx: 35, cy:  8 },
  { key: 'RC', cx: 65, cy:  8 },
  { key: 'RF', cx: 89, cy: 13 },
  { key: 'SS', cx: 33, cy: 42 },
  { key: '2B', cx: 67, cy: 42 },
  { key: '3B', cx: 14, cy: 58 },
  { key: '1B', cx: 86, cy: 58 },
  { key: 'P',  cx: 50, cy: 68 },
  { key: 'C',  cx: 50, cy: 84 },
] as const;

type PositionKey = typeof FIELD_POSITIONS[number]['key'];

function positionBorderColor(
  isSelected: boolean,
  isTarget: boolean,
  activePref: string | undefined,
  hasPlayer: boolean
): string {
  if (isSelected) return '#3B82F6';
  if (isTarget) {
    if (activePref === 'preferred') return '#22C55E';
    if (activePref === 'avoid') return '#EF4444';
    return '#93C5FD';
  }
  if (hasPlayer) return 'transparent';
  return 'rgba(255,255,255,0.45)';
}

function positionBgColor(
  isSelected: boolean,
  isTarget: boolean,
  activePref: string | undefined,
  hasPlayer: boolean
): string {
  if (isSelected) return '#EFF6FF';
  if (isTarget) {
    if (activePref === 'preferred') return 'rgba(34,197,94,0.18)';
    if (activePref === 'avoid') return 'rgba(239,68,68,0.14)';
    return 'rgba(255,255,255,0.15)';
  }
  if (hasPlayer) return 'rgba(255,255,255,0.93)';
  return 'rgba(255,255,255,0.12)';
}

function positionLabelColor(
  isSelected: boolean,
  isTarget: boolean,
  activePref: string | undefined,
  hasPlayer: boolean
): string {
  if (isSelected) return '#2563EB';
  if (isTarget) {
    if (activePref === 'preferred') return '#86EFAC';
    if (activePref === 'avoid') return '#FCA5A5';
    return '#BFDBFE';
  }
  if (hasPlayer) return '#6B7280';
  return 'rgba(255,255,255,0.75)';
}

export default function PositionsScreen() {
  const { players, fetchTeam } = useTeamStore();
  const { width: screenWidth } = useWindowDimensions();
  const containerW = screenWidth - HORIZONTAL_MARGIN;

  const [assignments, setAssignments] = useState<Record<string, Player | null>>(
    Object.fromEntries(FIELD_POSITIONS.map((p) => [p.key, null]))
  );
  const [selectedPos, setSelectedPos] = useState<PositionKey | null>(null);
  const [benchSelectedPlayer, setBenchSelectedPlayer] = useState<Player | null>(null);
  const [pickerPos, setPickerPos] = useState<PositionKey | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (players.length === 0) fetchTeam(TEAM_ID);
  }, []);

  const assignedIds = new Set(
    Object.values(assignments)
      .filter(Boolean)
      .map((p) => p!.id)
  );

  const benchPlayers = players.filter((p) => !assignedIds.has(p.id));

  function getPickerPlayers(posKey: string): Player[] {
    return [...players]
      .filter((p) => !assignedIds.has(p.id))
      .sort((a, b) => {
        const score = (p: Player) => {
          const pref = p.position_preferences?.find((pp) => pp.position === posKey)?.preference;
          return pref === 'preferred' ? 0 : pref === 'avoid' ? 2 : 1;
        };
        return score(a) - score(b);
      });
  }

  function handlePositionPress(posKey: PositionKey) {
    // Bench placement mode: assign the held player to this position
    if (benchSelectedPlayer !== null) {
      setAssignments((prev) => ({ ...prev, [posKey]: benchSelectedPlayer }));
      setBenchSelectedPlayer(null);
      return;
    }

    // Swap mode
    if (selectedPos !== null) {
      if (selectedPos === posKey) {
        setSelectedPos(null);
      } else {
        setAssignments((prev) => ({
          ...prev,
          [selectedPos]: prev[posKey],
          [posKey]: prev[selectedPos],
        }));
        setSelectedPos(null);
      }
      return;
    }

    if (assignments[posKey]) {
      setSelectedPos(posKey);
    } else {
      setPickerPos(posKey);
    }
  }

  function handleBenchPlayerPress(player: Player) {
    setSelectedPos(null);
    setBenchSelectedPlayer((prev) => (prev?.id === player.id ? null : player));
  }

  function handlePickPlayer(player: Player) {
    if (!pickerPos) return;
    setAssignments((prev) => ({ ...prev, [pickerPos]: player }));
    setPickerPos(null);
  }

  function handleLongPress(posKey: PositionKey) {
    setAssignments((prev) => ({ ...prev, [posKey]: null }));
    setSelectedPos(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await supabase.from('lineup_slots').delete().eq('lineup_id', LINEUP_ID);
      const rows: { lineup_id: string; inning: number; position: string; player_id: string }[] = [];
      for (let inning = 1; inning <= INNINGS_COUNT; inning++) {
        for (const pos of FIELD_POSITIONS) {
          const player = assignments[pos.key];
          if (player) {
            rows.push({ lineup_id: LINEUP_ID, inning, position: pos.key, player_id: player.id });
          }
        }
      }
      if (rows.length > 0) {
        await supabase.from('lineup_slots').insert(rows);
      }
    } finally {
      setSaving(false);
    }
  }

  const pickerPlayers = pickerPos ? getPickerPlayers(pickerPos) : [];
  const isBenchMode = benchSelectedPlayer !== null;
  // The player whose preferences should color the position targets
  const activePlayer = isBenchMode
    ? benchSelectedPlayer
    : selectedPos
    ? assignments[selectedPos]
    : null;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Defensive Alignment' }} />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Diamond field */}
        <View
          className="bg-green-700 mx-4 mt-4 rounded-2xl overflow-hidden"
          style={{ height: CONTAINER_H }}
        >
          {FIELD_POSITIONS.map(({ key, cx, cy }) => {
            const player = assignments[key];
            const isSelected = selectedPos === key;
            const isTarget = !isSelected && activePlayer !== null;
            const activePref = isTarget
              ? activePlayer!.position_preferences?.find((pp) => pp.position === key)?.preference
              : undefined;
            const left = containerW * (cx / 100) - BUTTON_W / 2;
            const top = CONTAINER_H * (cy / 100) - BUTTON_H / 2;

            return (
              <TouchableOpacity
                key={key}
                onPress={() => handlePositionPress(key)}
                onLongPress={() => { if (player) handleLongPress(key); }}
                activeOpacity={0.75}
                style={[
                  {
                    position: 'absolute',
                    left,
                    top,
                    width: BUTTON_W,
                    height: BUTTON_H,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderStyle: isTarget ? 'dashed' : 'solid',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                    backgroundColor: positionBgColor(isSelected, isTarget, activePref, !!player),
                    borderColor: positionBorderColor(isSelected, isTarget, activePref, !!player),
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '600',
                    color: positionLabelColor(isSelected, isTarget, activePref, !!player),
                  }}
                >
                  {key}
                </Text>
                {player && (
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: isSelected ? '#1D4ED8' : '#111827',
                    }}
                    numberOfLines={1}
                  >
                    {player.name.split(' ')[0]}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text className="text-xs text-gray-400 text-center mt-2 mb-4">
          {isBenchMode
            ? 'Tap a position to place · tap player again to cancel'
            : 'Tap to place · tap filled to swap · long-press to remove'}
        </Text>

        {/* Bench — players not yet placed */}
        {benchPlayers.length > 0 && (
          <View className="mx-4">
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Not yet placed ({benchPlayers.length})
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {benchPlayers.map((p) => {
                const isHeld = benchSelectedPlayer?.id === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => handleBenchPlayerPress(p)}
                    activeOpacity={0.7}
                    className={`rounded-lg px-3 py-2 flex-row items-center gap-1.5 border ${
                      isHeld
                        ? 'bg-blue-50 border-blue-400'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${isHeld ? 'text-blue-700' : 'text-gray-900'}`}
                    >
                      {p.name.split(' ')[0]}
                    </Text>
                    <View
                      className={`px-1.5 py-0.5 rounded-full ${p.gender === 'F' ? 'bg-pink-100' : 'bg-blue-100'}`}
                    >
                      <Text
                        className={`text-xs font-semibold ${p.gender === 'F' ? 'text-pink-700' : 'text-blue-700'}`}
                      >
                        {p.gender === 'F' ? 'W' : 'M'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <View className="px-4 pb-4 pt-2 bg-white border-t border-gray-100">
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="bg-brand rounded-xl py-3 items-center"
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-base">Save Alignment</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Player picker modal */}
      <Modal visible={pickerPos !== null} transparent animationType="slide">
        <View className="flex-1 justify-end">
          <TouchableOpacity className="flex-1" onPress={() => setPickerPos(null)} />
          <View className="bg-white rounded-t-2xl" style={{ maxHeight: 420 }}>
            <View className="px-4 py-4 border-b border-gray-100 flex-row items-center justify-between">
              <Text className="font-bold text-gray-900 text-base">Assign to {pickerPos}</Text>
              <TouchableOpacity onPress={() => setPickerPos(null)}>
                <Text className="text-blue-600 font-medium">Cancel</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={pickerPlayers}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => {
                const pref = item.position_preferences?.find(
                  (pp) => pp.position === pickerPos
                )?.preference;
                return (
                  <TouchableOpacity
                    onPress={() => handlePickPlayer(item)}
                    className="flex-row items-center px-4 py-3 border-b border-gray-50"
                  >
                    <View
                      className={`w-2 h-2 rounded-full mr-3 ${
                        pref === 'preferred'
                          ? 'bg-green-500'
                          : pref === 'avoid'
                          ? 'bg-red-400'
                          : 'bg-gray-200'
                      }`}
                    />
                    <Text
                      className={`flex-1 font-medium text-base ${
                        pref === 'avoid' ? 'text-gray-400' : 'text-gray-900'
                      }`}
                    >
                      {item.name}
                    </Text>
                    <View
                      className={`px-2 py-0.5 rounded-full ${
                        item.gender === 'F' ? 'bg-pink-100' : 'bg-blue-100'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          item.gender === 'F' ? 'text-pink-700' : 'text-blue-700'
                        }`}
                      >
                        {item.gender === 'F' ? 'W' : 'M'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text className="text-center text-gray-400 py-8">All players placed</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
