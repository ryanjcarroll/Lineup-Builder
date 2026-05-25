import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import Svg, { Polygon as SvgPolygon, Line, Path, Rect as SvgRect } from 'react-native-svg';
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
const HORIZONTAL_MARGIN = 32;

// Padding at top and bottom of the container is ~17px, derived from:
//   top: cy% * CONTAINER_H - BUTTON_H/2 = 17  → cy ≈ 12% for LC/RC
//   bottom: CONTAINER_H - (cy% * CONTAINER_H + BUTTON_H/2) = 17  → cy ≈ 88% for C
const FIELD_POSITIONS = [
  { key: 'LF', cx: 11, cy: 17 },
  { key: 'LC', cx: 35, cy: 12 },
  { key: 'RC', cx: 65, cy: 12 },
  { key: 'RF', cx: 89, cy: 17 },
  { key: 'SS', cx: 33, cy: 42 },
  { key: '2B', cx: 67, cy: 42 },
  { key: '3B', cx: 14, cy: 58 },
  { key: '1B', cx: 86, cy: 58 },
  { key: 'P',  cx: 50, cy: 68 },
  { key: 'C',  cx: 50, cy: 88 },
] as const;

type PositionKey = typeof FIELD_POSITIONS[number]['key'];

// ─── Diamond SVG ────────────────────────────────────────────────────────────

function DiamondSvg({ width }: { width: number }) {
  const H = CONTAINER_H;
  const cx = width / 2;
  const d = 75;

  const homeX = cx,     homeY = 294;
  const firstX = cx + d, firstY = homeY - d;
  const secondX = cx,    secondY = homeY - 2 * d;
  const thirdX = cx - d, thirdY = homeY - d;

  const bs = 10;
  const bh = bs / 2;
  const rubberY = homeY - d * 1.2;
  const foulEdgeY = homeY - cx;

  return (
    <Svg width={width} height={H} style={{ position: 'absolute', top: 0, left: 0 }}>
      <SvgPolygon
        points={`${homeX},${homeY} ${firstX},${firstY} ${secondX},${secondY} ${thirdX},${thirdY}`}
        fill="#7B5230"
        opacity={0.82}
      />
      <Line x1={homeX} y1={homeY} x2={width} y2={foulEdgeY} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
      <Line x1={homeX} y1={homeY} x2={0}     y2={foulEdgeY} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
      <Line x1={homeX}   y1={homeY}   x2={firstX}  y2={firstY}  stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
      <Line x1={firstX}  y1={firstY}  x2={secondX} y2={secondY} stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
      <Line x1={secondX} y1={secondY} x2={thirdX}  y2={thirdY}  stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
      <Line x1={thirdX}  y1={thirdY}  x2={homeX}   y2={homeY}   stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
      <Path
        d={`M 5,130 Q ${cx},2 ${width - 5},130`}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={1.5}
        fill="none"
      />
      <SvgRect x={cx - 5} y={rubberY - 2} width={10} height={4} fill="rgba(255,255,255,0.75)" rx={1} />
      <SvgRect x={firstX - bh}  y={firstY - bh}  width={bs} height={bs} fill="white" transform={`rotate(45, ${firstX}, ${firstY})`} />
      <SvgRect x={secondX - bh} y={secondY - bh} width={bs} height={bs} fill="white" transform={`rotate(45, ${secondX}, ${secondY})`} />
      <SvgRect x={thirdX - bh}  y={thirdY - bh}  width={bs} height={bs} fill="white" transform={`rotate(45, ${thirdX}, ${thirdY})`} />
      <SvgPolygon
        points={`${homeX - 8},${homeY - 6} ${homeX + 8},${homeY - 6} ${homeX + 8},${homeY + 2} ${homeX},${homeY + 10} ${homeX - 8},${homeY + 2}`}
        fill="white"
      />
    </Svg>
  );
}

// ─── Position button colors ──────────────────────────────────────────────────

// pref helpers shared by isTarget and isGrayedTarget
function prefBorderColor(pref: string | undefined) {
  if (pref === 'preferred') return '#22C55E';
  if (pref === 'avoid') return '#EF4444';
  return '#93C5FD';
}
function prefBgColor(pref: string | undefined) {
  if (pref === 'preferred') return 'rgba(34,197,94,0.18)';
  if (pref === 'avoid') return 'rgba(239,68,68,0.14)';
  return 'rgba(255,255,255,0.15)';
}
function prefLabelColor(pref: string | undefined) {
  if (pref === 'preferred') return '#86EFAC';
  if (pref === 'avoid') return '#FCA5A5';
  return '#BFDBFE';
}

function positionBorderColor(
  isSelected: boolean, hasPlayer: boolean,
  isTarget: boolean, activePref: string | undefined,
  isGrayed: boolean, grayedPref: string | undefined,
): string {
  if (isSelected) return '#3B82F6';
  if (isTarget) return prefBorderColor(activePref);
  if (isGrayed) return prefBorderColor(grayedPref);
  if (hasPlayer) return 'transparent';
  return 'rgba(255,255,255,0.45)';
}

function positionBgColor(
  isSelected: boolean, hasPlayer: boolean,
  isTarget: boolean, activePref: string | undefined,
  isGrayed: boolean,
): string {
  // Selected empty position: keep the dark field background, not white
  if (isSelected && !hasPlayer) return 'rgba(255,255,255,0.12)';
  if (isSelected) return '#EFF6FF';
  if (isTarget) return prefBgColor(activePref);
  // Grayed: dim the filled chip so it reads as de-emphasized
  if (isGrayed) return 'rgba(0,0,0,0.25)';
  if (hasPlayer) return 'rgba(255,255,255,0.93)';
  return 'rgba(255,255,255,0.12)';
}

function positionLabelColor(
  isSelected: boolean, hasPlayer: boolean,
  isTarget: boolean, activePref: string | undefined,
  isGrayed: boolean, grayedPref: string | undefined,
): string {
  if (isSelected) return '#2563EB';
  if (isTarget) return prefLabelColor(activePref);
  if (isGrayed) return prefLabelColor(grayedPref);
  if (hasPlayer) return '#6B7280';
  return 'rgba(255,255,255,0.75)';
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function PositionsScreen() {
  const { players, fetchTeam } = useTeamStore();
  const { width: screenWidth } = useWindowDimensions();
  const containerW = screenWidth - HORIZONTAL_MARGIN;

  const [assignments, setAssignments] = useState<Record<string, Player | null>>(
    Object.fromEntries(FIELD_POSITIONS.map((p) => [p.key, null]))
  );
  const [selectedPos, setSelectedPos] = useState<PositionKey | null>(null);
  const [benchSelectedPlayer, setBenchSelectedPlayer] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (players.length === 0) fetchTeam(TEAM_ID);
  }, []);

  const assignedIds = new Set(Object.values(assignments).filter(Boolean).map((p) => p!.id));
  const benchPlayers = players.filter((p) => !assignedIds.has(p.id));

  function handlePositionPress(posKey: PositionKey) {
    // Bench player held → place them here (replaces any existing player)
    if (benchSelectedPlayer !== null) {
      setAssignments((prev) => ({ ...prev, [posKey]: benchSelectedPlayer }));
      setBenchSelectedPlayer(null);
      return;
    }

    // A position is already selected
    if (selectedPos !== null) {
      if (selectedPos === posKey) {
        setSelectedPos(null);
        return;
      }
      const sourcePlayer = assignments[selectedPos];
      if (sourcePlayer) {
        // Source is filled → swap/move
        setAssignments((prev) => ({
          ...prev,
          [selectedPos]: prev[posKey],
          [posKey]: prev[selectedPos],
        }));
        setSelectedPos(null);
      } else {
        // Source was empty → just move the selection
        setSelectedPos(posKey);
      }
      return;
    }

    // Nothing selected → select this position (empty or filled)
    setSelectedPos(posKey);
  }

  function handleBenchPlayerPress(player: Player) {
    // If a field position is already selected, place bench player there directly
    if (selectedPos !== null) {
      setAssignments((prev) => ({ ...prev, [selectedPos]: player }));
      setSelectedPos(null);
      return;
    }
    // Otherwise toggle bench chip selection
    setBenchSelectedPlayer((prev) => (prev?.id === player.id ? null : player));
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

  const isBenchMode = benchSelectedPlayer !== null;
  // activePlayer drives preference coloring on position buttons
  const activePlayer = isBenchMode
    ? benchSelectedPlayer
    : selectedPos
    ? assignments[selectedPos]  // null if empty position selected
    : null;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Defensive Alignment' }} />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        <Pressable
          onPress={() => { setSelectedPos(null); setBenchSelectedPlayer(null); }}
          className="bg-green-700 mx-4 mt-4 rounded-2xl overflow-hidden"
          style={{ height: CONTAINER_H }}
        >
          <DiamondSvg width={containerW} />

          {FIELD_POSITIONS.map(({ key, cx, cy }) => {
            const player = assignments[key];
            const isSelected = selectedPos === key;
            // activePlayer drives preference coloring when bench player or filled position is selected
            const isTarget = !isSelected && activePlayer !== null;
            const activePref = isTarget
              ? activePlayer!.position_preferences?.find((pp) => pp.position === key)?.preference
              : undefined;
            // isGrayed: empty position selected → dim filled positions, color by their player's pref for selectedPos
            const emptyPosSelected = selectedPos !== null && !assignments[selectedPos];
            const isGrayed = emptyPosSelected && !!player && !isSelected;
            const grayedPref = isGrayed
              ? player!.position_preferences?.find((pp) => pp.position === selectedPos!)?.preference
              : undefined;

            const left = containerW * (cx / 100) - BUTTON_W / 2;
            const top = CONTAINER_H * (cy / 100) - BUTTON_H / 2;

            return (
              <TouchableOpacity
                key={key}
                onPress={() => handlePositionPress(key)}
                onLongPress={() => { if (player) handleLongPress(key); }}
                activeOpacity={0.75}
                style={{
                  position: 'absolute',
                  left,
                  top,
                  width: BUTTON_W,
                  height: BUTTON_H,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderStyle: isTarget || isGrayed || (isSelected && !player) ? 'dashed' : 'solid',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                  backgroundColor: positionBgColor(isSelected, !!player, isTarget, activePref, isGrayed),
                  borderColor: positionBorderColor(isSelected, !!player, isTarget, activePref, isGrayed, grayedPref),
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '600',
                    color: positionLabelColor(isSelected, !!player, isTarget, activePref, isGrayed, grayedPref),
                  }}
                >
                  {key}
                </Text>
                {player && (
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: isSelected ? '#1D4ED8' : isGrayed ? 'rgba(255,255,255,0.5)' : '#111827',
                    }}
                    numberOfLines={1}
                  >
                    {player.name.split(' ')[0]}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </Pressable>

        <Text className="text-xs text-gray-400 text-center mt-2 mb-4">
          {isBenchMode
            ? 'Tap a position to place · tap player again to cancel'
            : selectedPos
            ? 'Tap a bench player to fill · tap a position to move · tap again to cancel'
            : 'Tap any position or bench player to begin · long-press to remove'}
        </Text>

        {benchPlayers.length > 0 && (
          <View className="mx-4">
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Not yet placed ({benchPlayers.length})
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {benchPlayers.map((p) => {
                const isHeld = benchSelectedPlayer?.id === p.id;
                // When a field position is selected, color chips by preference for that position
                const chipPref = selectedPos
                  ? p.position_preferences?.find((pp) => pp.position === selectedPos)?.preference
                  : undefined;

                const borderCls = isHeld
                  ? 'border-blue-400'
                  : chipPref === 'preferred'
                  ? 'border-green-400'
                  : chipPref === 'avoid'
                  ? 'border-red-400'
                  : 'border-gray-200';

                const bgCls = isHeld
                  ? 'bg-blue-50'
                  : chipPref === 'preferred'
                  ? 'bg-green-50'
                  : chipPref === 'avoid'
                  ? 'bg-red-50'
                  : 'bg-white';

                const textCls = isHeld
                  ? 'text-blue-700'
                  : chipPref === 'preferred'
                  ? 'text-green-700'
                  : chipPref === 'avoid'
                  ? 'text-red-600'
                  : 'text-gray-900';

                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => handleBenchPlayerPress(p)}
                    activeOpacity={0.7}
                    className={`rounded-lg px-3 py-2 flex-row items-center gap-1.5 border ${bgCls} ${borderCls}`}
                  >
                    <Text className={`text-sm font-medium ${textCls}`}>
                      {p.name.split(' ')[0]}
                    </Text>
                    <View className={`px-1.5 py-0.5 rounded-full ${p.gender === 'F' ? 'bg-pink-100' : 'bg-blue-100'}`}>
                      <Text className={`text-xs font-semibold ${p.gender === 'F' ? 'text-pink-700' : 'text-blue-700'}`}>
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
    </SafeAreaView>
  );
}
