import { useState, useEffect, useRef } from 'react';
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
import { Stack, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import GenderCorner from '../../../components/GenderCorner';
import { DEFAULT_RULES } from '../../../components/EditRulesModal';
import { useTeamStore } from '../../../stores/teamStore';
import { useGameStore } from '../../../stores/gameStore';
import { supabase } from '../../../lib/supabase';
import { Player } from '../../../types/database';

const TEAM_ID       = '00000000-0000-0000-0000-000000000001';
const INNINGS_COUNT = 6;
const BUTTON_W  = 70;
const BUTTON_H  = 48;
const CONTAINER_H = 340;
const HORIZONTAL_MARGIN = 32;
const NAME_COL_W = 88;
const WARN_COL_W = 22;
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

// ─── Serialize assignments for change detection (only non-null entries) ───────

function serializeAssignments(assignments: Record<number, InningMap>): string {
  const result: Record<number, Record<string, string>> = {};
  for (const [inning, map] of Object.entries(assignments)) {
    const filled = Object.entries(map).filter(([, p]) => p !== null);
    if (filled.length > 0) {
      result[Number(inning)] = Object.fromEntries(filled.map(([pos, p]) => [pos, p!.id]));
    }
  }
  return JSON.stringify(result);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PositionsScreen() {
  const { team, players, fetchTeam } = useTeamStore();
  const { activeLineupId } = useGameStore();
  const minWomenField = team?.rules?.min_female_in_field ?? DEFAULT_RULES.min_female_in_field;
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const containerW = screenWidth - HORIZONTAL_MARGIN;

  const [currentInning, setCurrentInning] = useState(1);
  const [inningAssignments, setInningAssignments] = useState<Record<number, InningMap>>({ 1: emptyInning() });
  const [selectedPos, setSelectedPos] = useState<PositionKey | null>(null);
  const [benchSelectedPlayer, setBenchSelectedPlayer] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);

  // Track saved state for unsaved-changes detection
  const savedAssignmentsJson = useRef<string>('{}');
  const hasUnsavedChanges = useRef(false);
  hasUnsavedChanges.current = serializeAssignments(inningAssignments) !== savedAssignmentsJson.current;

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!hasUnsavedChanges.current) return;
      e.preventDefault();
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes to the defensive alignment. Leave without saving?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]
      );
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => { if (players.length === 0) fetchTeam(TEAM_ID); }, []);

  // Load existing lineup slots when lineup changes
  useEffect(() => {
    if (!activeLineupId) { setInningAssignments({ 1: emptyInning() }); return; }
    supabase
      .from('lineup_slots')
      .select('inning, position, player_id')
      .eq('lineup_id', activeLineupId)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const built: Record<number, InningMap> = {};
        data.forEach(({ inning, position, player_id }) => {
          if (!built[inning]) built[inning] = emptyInning();
          const player = players.find((p) => p.id === player_id);
          if (player) built[inning][position] = player;
        });
        savedAssignmentsJson.current = serializeAssignments(built);
        setInningAssignments(built);
      });
  }, [activeLineupId, players]);

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
    if (placed.filter(p => p.gender === 'F').length < minWomenField) {
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

  function handleRowPress(player: Player) {
    // If a position is selected, assign this player to it
    if (selectedPos !== null) {
      if (assignments[selectedPos]?.id === player.id) {
        setSelectedPos(null);
        return;
      }
      const occupant = assignments[selectedPos];
      const playerCurrentPos = Object.entries(assignments).find(([, p]) => p?.id === player.id)?.[0];
      updateAssignments(prev => {
        const next = { ...prev };
        if (playerCurrentPos) next[playerCurrentPos] = occupant ?? null;
        next[selectedPos] = player;
        return next;
      });
      setSelectedPos(null);
      return;
    }

    // Toggle off if already selected
    if (player.id === selectedPlayerId) {
      setSelectedPos(null);
      setBenchSelectedPlayer(null);
      return;
    }

    // Select player — if they have a position this inning, select that position; otherwise bench-select
    const fieldPos = Object.entries(assignments).find(([, p]) => p?.id === player.id)?.[0] as PositionKey | undefined;
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
    if (!activeLineupId) return;
    setSaving(true);
    try {
      await supabase.from('lineup_slots').delete().eq('lineup_id', activeLineupId);
      const rows: { lineup_id: string; inning: number; position: string; player_id: string }[] = [];
      for (const [innStr, map] of Object.entries(inningAssignments)) {
        for (const [pos, player] of Object.entries(map)) {
          if (player) rows.push({ lineup_id: activeLineupId, inning: Number(innStr), position: pos, player_id: player.id });
        }
      }
      if (rows.length) await supabase.from('lineup_slots').insert(rows as any);
      savedAssignmentsJson.current = serializeAssignments(inningAssignments);
    } finally {
      setSaving(false);
    }
  }

  const isBenchMode      = benchSelectedPlayer !== null;
  const activePlayer     = isBenchMode ? benchSelectedPlayer : selectedPos ? assignments[selectedPos] : null;
  const selectedPlayerId = benchSelectedPlayer?.id ?? (selectedPos ? assignments[selectedPos]?.id : undefined);
  const inningNums       = Array.from({ length: INNINGS_COUNT }, (_, i) => i + 1);

  const bannerWarnings: string[] = [];
  inningNums.forEach(n => {
    getInningColWarnings(n).forEach(w => bannerWarnings.push(`Inning ${n}: ${w}`));
  });
  players.forEach(p => {
    getPlayerRowWarnings(p).forEach(w => bannerWarnings.push(`${p.name.split(' ')[0]}: ${w}`));
  });
  const hintText = isBenchMode
    ? 'Tap a position to place · tap player again to cancel'
    : selectedPos && !assignments[selectedPos]
    ? 'Tap a player to assign · tap position again to cancel'
    : selectedPos
    ? 'Tap a player or position to move · tap again to cancel'
    : 'Tap a player or position to begin · long-press to remove';

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
            <TouchableOpacity onPress={handleSave} disabled={saving || !activeLineupId} style={{ paddingHorizontal: 4, opacity: activeLineupId ? 1 : 0.4 }}>
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
                  overflow: 'hidden',
                  backgroundColor: posBgColor(isSelected, !!player, isTarget, aPref, isGrayed),
                  borderColor:     posBorderColor(isSelected, !!player, isTarget, aPref, isGrayed, gPref),
                }}
              >
                {player && <GenderCorner gender={player.gender} size={8} />}
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

        <TouchableOpacity
          onPress={() => bannerWarnings.length > 0 && Alert.alert('Alignment Issues', bannerWarnings.join('\n\n'))}
          activeOpacity={bannerWarnings.length > 0 ? 0.7 : 1}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            marginHorizontal: 16, marginTop: 6, marginBottom: 4,
            paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8,
            backgroundColor: bannerWarnings.length > 0 ? '#FEF9C3' : '#F3F4F6',
            ...(bannerWarnings.length > 0 ? { borderWidth: 1, borderColor: '#FDE68A' } : {}),
          }}
        >
          {bannerWarnings.length > 0 && <Text style={{ fontSize: 13 }}>⚠</Text>}
          <Text style={{ fontSize: 12, color: bannerWarnings.length > 0 ? '#854D0E' : '#9CA3AF', textAlign: 'center' }}>
            {bannerWarnings.length > 0
              ? `${bannerWarnings.length} issue${bannerWarnings.length > 1 ? 's' : ''} — tap for details`
              : hintText}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Independently scrollable player table ────────────────────────── */}
      <View style={{ flex: 1, marginHorizontal: 16, marginBottom: 12 }} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Sticky header */}
        <View className="flex-row items-end px-3 py-2 border-b border-gray-100 bg-gray-50">
          <View style={{ width: NAME_COL_W }}>
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Player</Text>
          </View>
          {inningNums.map(n => (
            <View key={n} style={{ flex: 1 }} className="items-center">
              <Text className={`text-xs font-semibold ${n === currentInning ? 'text-brand' : 'text-gray-400'}`}>
                {n}
              </Text>
            </View>
          ))}
        </View>

        {/* Scrollable rows */}
        <ScrollView showsVerticalScrollIndicator={false}>
          {sortedPlayers.map((player, idx) => {
            const isRowSelected = player.id === selectedPlayerId;
            const isLast       = idx === sortedPlayers.length - 1;
            const prefForPos   = selectedPos
              ? player.position_preferences?.find(pp => pp.position === selectedPos)?.preference
              : null;
            const rowBg = isRowSelected
              ? '#EFF6FF'
              : prefForPos === 'preferred' ? '#bcf5cf'
              : prefForPos === 'avoid'     ? '#FFF1F2'
              : undefined;

            return (
              <TouchableOpacity
                key={player.id}
                onPress={() => handleRowPress(player)}
                activeOpacity={0.6}
                style={rowBg ? { backgroundColor: rowBg } : undefined}
                className={`flex-row items-center ${!isLast ? 'border-b border-gray-50' : ''}`}
              >
                <View style={{ width: NAME_COL_W, overflow: 'hidden' }} className="flex-row items-center gap-1 px-3 py-2.5">
                  <GenderCorner gender={player.gender} size={8} />
                  <Text className="text-sm font-medium text-gray-900 flex-shrink" numberOfLines={1}>
                    {player.name.split(' ')[0]}
                  </Text>
                </View>

                {/* Inning cells */}
                {inningNums.map(n => {
                  const pos          = getPlayerPosition(player.id, n);
                  const hasData      = !!inningAssignments[n];
                  const isCellSelected = n === currentInning && player.id === selectedPlayerId;
                  const { text, bg } = cellColors(pos);

                  return (
                    <View key={n} style={{ flex: 1 }} className="items-center py-2.5">
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
                    </View>
                  );
                })}


              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

    </SafeAreaView>
  );
}
