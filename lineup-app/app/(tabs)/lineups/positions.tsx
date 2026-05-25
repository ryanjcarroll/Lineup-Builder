import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
  Alert,
} from 'react-native';
import Svg, { Polygon as SvgPolygon, Line, Path, Rect as SvgRect } from 'react-native-svg';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTeamStore } from '../../../stores/teamStore';
import { supabase } from '../../../lib/supabase';
import { Player } from '../../../types/database';

const TEAM_ID   = '00000000-0000-0000-0000-000000000001';
const LINEUP_ID = '30000000-0000-0000-0000-000000000001';
const INNINGS_COUNT = 6;
const BUTTON_W  = 70;
const BUTTON_H  = 48;
const CONTAINER_H = 340;
const HORIZONTAL_MARGIN = 32;
const NAME_COL_W = 88;
const WARN_COL_W = 22;
const MIN_WOMEN_ON_FIELD = 4;

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
type InningMap = Record<string, Player | null>;

function emptyInning(): InningMap {
  return Object.fromEntries(FIELD_POSITIONS.map(p => [p.key, null]));
}

// ─── Diamond SVG ─────────────────────────────────────────────────────────────

function DiamondSvg({ width }: { width: number }) {
  const cx = width / 2;
  const d  = 75;
  const homeX = cx,     homeY = 294;
  const firstX = cx + d, firstY = homeY - d;
  const secondX = cx,    secondY = homeY - 2 * d;
  const thirdX = cx - d, thirdY = homeY - d;
  const bs = 10, bh = bs / 2;
  const rubberY = homeY - d * 1.2;
  const foulEdgeY = homeY - cx;

  return (
    <Svg width={width} height={CONTAINER_H} style={{ position: 'absolute', top: 0, left: 0 }}>
      <SvgPolygon points={`${homeX},${homeY} ${firstX},${firstY} ${secondX},${secondY} ${thirdX},${thirdY}`} fill="#7B5230" opacity={0.82} />
      <Line x1={homeX} y1={homeY} x2={width} y2={foulEdgeY} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
      <Line x1={homeX} y1={homeY} x2={0}     y2={foulEdgeY} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
      <Line x1={homeX}   y1={homeY}   x2={firstX}  y2={firstY}  stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
      <Line x1={firstX}  y1={firstY}  x2={secondX} y2={secondY} stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
      <Line x1={secondX} y1={secondY} x2={thirdX}  y2={thirdY}  stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
      <Line x1={thirdX}  y1={thirdY}  x2={homeX}   y2={homeY}   stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
      <Path d={`M 5,130 Q ${cx},2 ${width - 5},130`} stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} fill="none" />
      <SvgRect x={cx - 5} y={rubberY - 2} width={10} height={4} fill="rgba(255,255,255,0.75)" rx={1} />
      <SvgRect x={firstX - bh}  y={firstY - bh}  width={bs} height={bs} fill="white" transform={`rotate(45,${firstX},${firstY})`} />
      <SvgRect x={secondX - bh} y={secondY - bh} width={bs} height={bs} fill="white" transform={`rotate(45,${secondX},${secondY})`} />
      <SvgRect x={thirdX - bh}  y={thirdY - bh}  width={bs} height={bs} fill="white" transform={`rotate(45,${thirdX},${thirdY})`} />
      <SvgPolygon points={`${homeX-8},${homeY-6} ${homeX+8},${homeY-6} ${homeX+8},${homeY+2} ${homeX},${homeY+10} ${homeX-8},${homeY+2}`} fill="white" />
    </Svg>
  );
}

// ─── Field button colors ──────────────────────────────────────────────────────

function prefBorder(p?: string) { return p === 'preferred' ? '#22C55E' : p === 'avoid' ? '#EF4444' : '#93C5FD'; }
function prefBg(p?: string)     { return p === 'preferred' ? 'rgba(34,197,94,0.18)' : p === 'avoid' ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.15)'; }
function prefLabel(p?: string)  { return p === 'preferred' ? '#86EFAC' : p === 'avoid' ? '#FCA5A5' : '#BFDBFE'; }

function posBorderColor(isSelected: boolean, hasPlayer: boolean, isTarget: boolean, aPref?: string, isGrayed?: boolean, gPref?: string) {
  if (isSelected) return '#3B82F6';
  if (isTarget)   return prefBorder(aPref);
  if (isGrayed)   return prefBorder(gPref);
  return hasPlayer ? 'transparent' : 'rgba(255,255,255,0.45)';
}
function posBgColor(isSelected: boolean, hasPlayer: boolean, isTarget: boolean, aPref?: string, isGrayed?: boolean) {
  if (isSelected && !hasPlayer) return 'rgba(255,255,255,0.12)';
  if (isSelected)  return '#EFF6FF';
  if (isTarget)    return prefBg(aPref);
  if (isGrayed)    return 'rgba(0,0,0,0.25)';
  return hasPlayer ? 'rgba(255,255,255,0.93)' : 'rgba(255,255,255,0.12)';
}
function posLabelColor(isSelected: boolean, hasPlayer: boolean, isTarget: boolean, aPref?: string, isGrayed?: boolean, gPref?: string) {
  if (isSelected)  return '#2563EB';
  if (isTarget)    return prefLabel(aPref);
  if (isGrayed)    return prefLabel(gPref);
  return hasPlayer ? '#6B7280' : 'rgba(255,255,255,0.75)';
}

// ─── Table cell colors ────────────────────────────────────────────────────────

function cellColors(pos: string | null): { text: string; bg: string } {
  if (!pos) return { text: '#9CA3AF', bg: 'transparent' };
  if (pos === 'P' || pos === 'C')             return { text: '#B45309', bg: '#FEF3C7' };
  if (['SS', '2B', '3B', '1B'].includes(pos)) return { text: '#1D4ED8', bg: '#DBEAFE' };
  return { text: '#15803D', bg: '#DCFCE7' };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PositionsScreen() {
  const { players, fetchTeam } = useTeamStore();
  const { width: screenWidth } = useWindowDimensions();
  const containerW = screenWidth - HORIZONTAL_MARGIN;

  const [currentInning, setCurrentInning] = useState(1);
  const [inningAssignments, setInningAssignments] = useState<Record<number, InningMap>>({ 1: emptyInning() });
  const [selectedPos, setSelectedPos] = useState<PositionKey | null>(null);
  const [benchSelectedPlayer, setBenchSelectedPlayer] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (players.length === 0) fetchTeam(TEAM_ID); }, []);

  const assignments = inningAssignments[currentInning] ?? emptyInning();

  function updateAssignments(fn: (prev: InningMap) => InningMap) {
    setInningAssignments(prev => ({ ...prev, [currentInning]: fn(prev[currentInning] ?? emptyInning()) }));
  }

  // No auto-copy — switching to an uninitialised inning starts blank
  function switchInning(n: number) {
    setCurrentInning(n);
    setSelectedPos(null);
    setBenchSelectedPlayer(null);
    setInningAssignments(prev => prev[n] ? prev : { ...prev, [n]: emptyInning() });
  }

  function getPlayerPosition(playerId: string, inning: number): string | null {
    const inn = inningAssignments[inning];
    if (!inn) return null;
    return Object.entries(inn).find(([, p]) => p?.id === playerId)?.[0] ?? null;
  }

  function getWarning(playerId: string): 'bench' | 'repeat' | null {
    const set = Array.from({ length: INNINGS_COUNT }, (_, i) => i + 1).filter(n => !!inningAssignments[n]);
    if (set.length < 2) return null;
    for (let i = 0; i < set.length - 1; i++) {
      if (!getPlayerPosition(playerId, set[i]) && !getPlayerPosition(playerId, set[i + 1])) return 'bench';
    }
    const counts: Record<string, number> = {};
    for (const n of set) {
      const pos = getPlayerPosition(playerId, n);
      if (pos) { counts[pos] = (counts[pos] ?? 0) + 1; if (counts[pos] >= 3) return 'repeat'; }
    }
    return null;
  }

  function isInningFull(inning: number): boolean {
    const inn = inningAssignments[inning];
    return !!inn && Object.values(inn).filter(Boolean).length === FIELD_POSITIONS.length;
  }

  function getPlayerRowWarnings(player: Player): string[] {
    const set = Array.from({ length: INNINGS_COUNT }, (_, i) => i + 1).filter(n => !!inningAssignments[n]);
    const warnings: string[] = [];
    if (set.length >= 2) {
      for (let i = 0; i < set.length - 1; i++) {
        const n1 = set[i], n2 = set[i + 1];
        if (isInningFull(n1) && isInningFull(n2) &&
            !getPlayerPosition(player.id, n1) && !getPlayerPosition(player.id, n2)) {
          warnings.push('Benched 2 consecutive innings');
          break;
        }
      }
    }
    const avoidedPositions = [...new Set(
      set
        .map(n => getPlayerPosition(player.id, n))
        .filter((pos): pos is string =>
          !!pos && player.position_preferences?.find(pp => pp.position === pos)?.preference === 'avoid'
        )
    )];
    if (avoidedPositions.length > 0) {
      warnings.push(`Assigned to avoided position (${avoidedPositions.join(', ')})`);
    }
    return warnings;
  }

  function getInningColWarnings(inning: number): string[] {
    if (!isInningFull(inning)) return [];
    const placed = Object.values(inningAssignments[inning]).filter(Boolean) as Player[];
    const warnings: string[] = [];
    if (placed.filter(p => p.gender === 'F').length < MIN_WOMEN_ON_FIELD) {
      warnings.push('Not enough women in field');
    }
    return warnings;
  }

  function handlePositionPress(posKey: PositionKey) {
    if (benchSelectedPlayer !== null) {
      updateAssignments(prev => ({ ...prev, [posKey]: benchSelectedPlayer }));
      setBenchSelectedPlayer(null);
      return;
    }
    if (selectedPos !== null) {
      if (selectedPos === posKey) { setSelectedPos(null); return; }
      if (assignments[selectedPos]) {
        updateAssignments(prev => ({ ...prev, [selectedPos]: prev[posKey], [posKey]: prev[selectedPos] }));
        setSelectedPos(null);
      } else {
        setSelectedPos(posKey);
      }
      return;
    }
    setSelectedPos(posKey);
  }

  // Tapping any table cell: jump to that inning and select that player.
  // React 18 batches all setState calls here, so the selection setters below
  // override the null-clears that switchInning schedules internally.
  function handleCellPress(player: Player, inning: number) {
    // If a position is selected, use only the player — ignore which inning column was tapped
    if (selectedPos !== null) {
      // Tapping the player already occupying the selected position cancels selection
      if (assignments[selectedPos]?.id === player.id) {
        setSelectedPos(null);
        return;
      }
      const occupant = assignments[selectedPos];
      const playerCurrentPos = Object.entries(assignments).find(([, p]) => p?.id === player.id)?.[0];
      updateAssignments(prev => {
        const next = { ...prev };
        // Swap occupant into the player's old position (or bench them if player had none)
        if (playerCurrentPos) next[playerCurrentPos] = occupant ?? null;
        next[selectedPos] = player;
        return next;
      });
      setSelectedPos(null);
      return;
    }

    // Toggle off if already selected for this exact cell
    if (inning === currentInning && player.id === selectedPlayerId) {
      setSelectedPos(null);
      setBenchSelectedPlayer(null);
      return;
    }

    const targetData = inningAssignments[inning] ?? emptyInning();
    const fieldPos = Object.entries(targetData).find(([, p]) => p?.id === player.id)?.[0] as PositionKey | undefined;

    // Switch inning without auto-copy
    setCurrentInning(inning);
    setInningAssignments(prev => prev[inning] ? prev : { ...prev, [inning]: emptyInning() });

    // Set selection — these run after the null-clears inside switchInning so they win
    if (fieldPos) {
      setBenchSelectedPlayer(null);
      setSelectedPos(fieldPos);
    } else {
      setSelectedPos(null);
      setBenchSelectedPlayer(player);
    }
  }

  function handleLongPress(posKey: PositionKey) {
    updateAssignments(prev => ({ ...prev, [posKey]: null }));
    setSelectedPos(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await supabase.from('lineup_slots').delete().eq('lineup_id', LINEUP_ID);
      const rows: { lineup_id: string; inning: number; position: string; player_id: string }[] = [];
      for (const [innStr, map] of Object.entries(inningAssignments)) {
        for (const [pos, player] of Object.entries(map)) {
          if (player) rows.push({ lineup_id: LINEUP_ID, inning: Number(innStr), position: pos, player_id: player.id });
        }
      }
      if (rows.length) await supabase.from('lineup_slots').insert(rows as any);
    } finally {
      setSaving(false);
    }
  }

  const isBenchMode      = benchSelectedPlayer !== null;
  const activePlayer     = isBenchMode ? benchSelectedPlayer : selectedPos ? assignments[selectedPos] : null;
  const selectedPlayerId = benchSelectedPlayer?.id ?? (selectedPos ? assignments[selectedPos]?.id : undefined);
  const inningNums       = Array.from({ length: INNINGS_COUNT }, (_, i) => i + 1);

  const sortedPlayers = selectedPos
    ? [...players].sort((a, b) => {
        const getPref = (p: Player) => p.position_preferences?.find(pp => pp.position === selectedPos)?.preference;
        const rank = (pref?: string) => pref === 'preferred' ? 0 : pref === 'avoid' ? 2 : 1;
        return rank(getPref(a)) - rank(getPref(b));
      })
    : players;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={[]}>
      <Stack.Screen
        options={{
          title: 'Defensive Alignment',
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={saving} style={{ paddingHorizontal: 4 }}>
              {saving
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Save</Text>}
            </TouchableOpacity>
          ),
        }}
      />

      {/* ── Fixed top: tabs + diamond + hint ─────────────────────────────── */}
      <View>
        <View className="flex-row mx-4 mt-4 gap-1.5">
          {inningNums.map(n => {
            const isCurrent = n === currentInning;
            const hasData   = inningAssignments[n] && Object.values(inningAssignments[n]).some(Boolean);
            return (
              <TouchableOpacity
                key={n}
                onPress={() => switchInning(n)}
                className={`flex-1 py-2 rounded-lg items-center ${isCurrent ? 'bg-brand' : 'bg-white border border-gray-200'}`}
              >
                <Text className={`text-sm font-bold ${isCurrent ? 'text-white' : hasData ? 'text-gray-700' : 'text-gray-300'}`}>
                  {n}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Pressable
          onPress={() => { setSelectedPos(null); setBenchSelectedPlayer(null); }}
          className="bg-green-700 mx-4 mt-3 rounded-2xl overflow-hidden"
          style={{ height: CONTAINER_H }}
        >
          <DiamondSvg width={containerW} />
          {FIELD_POSITIONS.map(({ key, cx, cy }) => {
            const player       = assignments[key];
            const isSelected   = selectedPos === key;
            const isTarget     = !isSelected && activePlayer !== null;
            const aPref        = isTarget ? activePlayer!.position_preferences?.find(pp => pp.position === key)?.preference : undefined;
            const emptySelected = selectedPos !== null && !assignments[selectedPos];
            const isGrayed     = emptySelected && !!player && !isSelected;
            const gPref        = isGrayed ? player!.position_preferences?.find(pp => pp.position === selectedPos!)?.preference : undefined;
            const left = containerW * (cx / 100) - BUTTON_W / 2;
            const top  = CONTAINER_H * (cy / 100) - BUTTON_H / 2;

            return (
              <TouchableOpacity
                key={key}
                onPress={() => handlePositionPress(key)}
                onLongPress={() => { if (player) handleLongPress(key); }}
                activeOpacity={0.75}
                style={{
                  position: 'absolute', left, top,
                  width: BUTTON_W, height: BUTTON_H,
                  borderRadius: 8, borderWidth: 2,
                  borderStyle: isTarget || isGrayed || (isSelected && !player) ? 'dashed' : 'solid',
                  alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
                  backgroundColor: posBgColor(isSelected, !!player, isTarget, aPref, isGrayed),
                  borderColor:     posBorderColor(isSelected, !!player, isTarget, aPref, isGrayed, gPref),
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '600', color: posLabelColor(isSelected, !!player, isTarget, aPref, isGrayed, gPref) }}>
                  {key}
                </Text>
                {player && (
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? '#1D4ED8' : isGrayed ? 'rgba(255,255,255,0.5)' : '#111827' }} numberOfLines={1}>
                    {player.name.split(' ')[0]}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </Pressable>

        <Text className="text-xs text-gray-400 text-center mt-2 mb-2">
          {isBenchMode
            ? 'Tap a position to place · tap player again to cancel'
            : selectedPos && !assignments[selectedPos]
            ? 'Tap a player to assign · tap position again to cancel'
            : selectedPos
            ? 'Tap a player or position to move · tap again to cancel'
            : 'Tap any position or player to begin · long-press to remove'}
        </Text>
      </View>

      {/* ── Independently scrollable player table ────────────────────────── */}
      <View style={{ flex: 1, marginHorizontal: 16, marginBottom: 12 }} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Sticky header */}
        <View className="flex-row items-end px-3 py-2 border-b border-gray-100 bg-gray-50">
          <View style={{ width: NAME_COL_W }}>
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Player</Text>
          </View>
          {inningNums.map(n => {
            const colWarns = getInningColWarnings(n);
            return (
              <View key={n} style={{ flex: 1 }} className="items-center">
                {colWarns.length > 0
                  ? <TouchableOpacity onPress={() => Alert.alert('Inning Warning', colWarns.join('\n\n'))}>
                      <Text style={{ fontSize: 11, color: '#EAB308', lineHeight: 14 }}>⚠</Text>
                    </TouchableOpacity>
                  : <View style={{ height: 14 }} />}
                <TouchableOpacity onPress={() => switchInning(n)}>
                  <Text className={`text-xs font-semibold ${n === currentInning ? 'text-brand' : 'text-gray-400'}`}>
                    {n}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
          <View style={{ width: WARN_COL_W }} />
        </View>

        {/* Scrollable rows */}
        <ScrollView showsVerticalScrollIndicator={false}>
          {sortedPlayers.map((player, idx) => {
            const warning      = getWarning(player.id);
            const rowWarnings  = getPlayerRowWarnings(player);
            const isRowSelected = player.id === selectedPlayerId;
            const isLast       = idx === sortedPlayers.length - 1;
            const prefForPos   = selectedPos
              ? player.position_preferences?.find(pp => pp.position === selectedPos)?.preference
              : null;
            const dotColor     = prefForPos === 'preferred' ? '#22C55E'
              : prefForPos === 'avoid'      ? '#EF4444'
              : warning === 'bench'         ? '#FCD34D'
              : warning === 'repeat'        ? '#F97316'
              : '#D1D5DB';

            return (
              <View
                key={player.id}
                className={`flex-row items-center ${!isLast ? 'border-b border-gray-50' : ''} ${isRowSelected ? 'bg-blue-50' : ''}`}
              >
                {/* Name cell — tapping selects for the current inning */}
                <TouchableOpacity
                  onPress={() => handleCellPress(player, currentInning)}
                  activeOpacity={0.6}
                  style={{ width: NAME_COL_W }}
                  className="flex-row items-center gap-1 px-3 py-2.5"
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor, flexShrink: 0 }} />
                  <Text className="text-sm font-medium text-gray-900 flex-shrink" numberOfLines={1}>
                    {player.name.split(' ')[0]}
                  </Text>
                  <View className={`px-1 rounded-full flex-shrink-0 ${player.gender === 'F' ? 'bg-pink-100' : 'bg-blue-100'}`}>
                    <Text className={`text-xs font-semibold ${player.gender === 'F' ? 'text-pink-700' : 'text-blue-700'}`}>
                      {player.gender === 'F' ? 'W' : 'M'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Inning cells */}
                {inningNums.map(n => {
                  const pos          = getPlayerPosition(player.id, n);
                  const hasData      = !!inningAssignments[n];
                  const isCellSelected = n === currentInning && player.id === selectedPlayerId;
                  const { text, bg } = cellColors(pos);

                  return (
                    <TouchableOpacity
                      key={n}
                      onPress={() => handleCellPress(player, n)}
                      activeOpacity={0.6}
                      style={{ flex: 1 }}
                      className="items-center py-2.5"
                    >
                      {hasData ? (
                        <View style={{
                          backgroundColor: isCellSelected ? '#3B82F6' : bg,
                          borderRadius: 4,
                          paddingHorizontal: 3,
                          paddingVertical: 1,
                          minWidth: 26,
                          alignItems: 'center',
                        }}>
                          <Text style={{
                            fontSize: 10,
                            fontWeight: n === currentInning ? '700' : '500',
                            color: isCellSelected ? 'white' : text,
                          }}>
                            {pos ?? '—'}
                          </Text>
                        </View>
                      ) : isCellSelected ? (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' }} />
                      ) : (
                        <Text style={{ fontSize: 12, color: '#E5E7EB' }}>·</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Row warning */}
                <TouchableOpacity
                  style={{ width: WARN_COL_W, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => rowWarnings.length > 0 && Alert.alert('Player Warning', rowWarnings.join('\n\n'))}
                  activeOpacity={rowWarnings.length > 0 ? 0.6 : 1}
                >
                  {rowWarnings.length > 0 && (
                    <Text style={{ fontSize: 11, color: '#EAB308' }}>⚠</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      </View>

    </SafeAreaView>
  );
}
