import { useState, useEffect, useRef } from 'react';
import {
  useWindowDimensions, View, Text, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Svg, {
  Polygon as SvgPolygon, Rect as SvgRect, Text as SvgText,
  Line as SvgLine, Path as SvgPath, Defs, ClipPath,
} from 'react-native-svg';
import { useTeamStore } from '../stores/teamStore';
import { useGameStore } from '../stores/gameStore';
import { supabase } from '../lib/supabase';
import { playerName, playerGender } from '../types/database';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:      '#0F172A',
  surface: '#1E293B',
  border:  '#334155',
  accent:  '#3B82F6',
  text:    '#F1F5F9',
  muted:   '#64748B',
  mutedLt: '#94A3B8',
  male:    '#60A5FA',
  female:  '#F472B6',
  field:   '#14532D',
  dirt:    '#92400E',
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatGameDate(dateStr: string, startTime?: string | null): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return startTime ? `${label} · ${startTime}` : label;
}

// First name, last initial if first name is shared, truncated for SVG labels
function shortName(name: string, allNames: string[]): string {
  const parts = name.trim().split(' ');
  const first = parts[0];
  const hasDupe = allNames.some((n) => n !== name && n.trim().split(' ')[0] === first);
  const label = hasDupe && parts.length > 1
    ? `${first} ${parts[parts.length - 1][0]}`
    : first;
  return label.length > 7 ? label.slice(0, 7) : label;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type BatterRow = { name: string; gender: 'M' | 'F' };
type InningSlots = Record<string, string>; // position key → short name

// ─── Mini diamond SVG ─────────────────────────────────────────────────────────

const FIELD_POS = [
  { key: 'LF', fx: 0.18, fy: 0.16 },
  { key: 'LC', fx: 0.36, fy: 0.11 },
  { key: 'CF', fx: 0.50, fy: 0.07 },
  { key: 'RC', fx: 0.64, fy: 0.11 },
  { key: 'RF', fx: 0.82, fy: 0.16 },
  { key: 'SS', fx: 0.37, fy: 0.47 },
  { key: '2B', fx: 0.63, fy: 0.47 },
  { key: '3B', fx: 0.21, fy: 0.61 },
  { key: '1B', fx: 0.79, fy: 0.61 },
  { key: 'P',  fx: 0.50, fy: 0.68 },
  { key: 'C',  fx: 0.50, fy: 0.93 },
] as const;

function InningDiamond({ slots, w, h, id }: { slots: InningSlots; w: number; h: number; id: string }) {
  const cx = w / 2;
  const homeY  = h * 0.87;
  const d      = h * 0.185;
  const firstX = cx + d, firstY  = homeY - d;
  const secX   = cx,     secY    = homeY - 2 * d;
  const thirdX = cx - d, thirdY  = homeY - d;
  const foulEndY = homeY - cx;
  const r      = d * 2.5;
  const arcEndY = homeY - r / Math.SQRT2;
  const arcLX   = cx    - r / Math.SQRT2;
  const arcRX   = cx    + r / Math.SQRT2;
  const arcR    = r * 0.78;
  const diamondPts = `${cx},${homeY} ${firstX},${firstY} ${secX},${secY} ${thirdX},${thirdY}`;
  const fairPts    = `${cx},${homeY} 0,${foulEndY} 0,0 ${w},0 ${w},${foulEndY}`;
  const clipId     = `ft-${id}`;

  return (
    <Svg width={w} height={h}>
      <Defs>
        <ClipPath id={clipId}>
          <SvgPolygon points={fairPts} />
        </ClipPath>
      </Defs>
      <SvgRect x={0} y={0} width={w} height={h} fill={C.field} rx={6} />
      <SvgLine x1={cx} y1={homeY} x2={0} y2={foulEndY} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
      <SvgLine x1={cx} y1={homeY} x2={w} y2={foulEndY} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
      <SvgPath
        d={`M ${arcLX},${arcEndY} A ${arcR},${arcR} 0 0 1 ${arcRX},${arcEndY} L ${cx},${homeY} Z`}
        clipPath={`url(#${clipId})`}
        fill={C.dirt}
        opacity={0.55}
        stroke="none"
      />
      <SvgPath
        d={`M ${arcLX},${arcEndY} A ${arcR},${arcR} 0 0 1 ${arcRX},${arcEndY}`}
        clipPath={`url(#${clipId})`}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1}
        fill="none"
      />
      <SvgPolygon points={diamondPts} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={0.8} />
      {FIELD_POS.map(({ key, fx, fy }) => {
        const label = slots[key];
        if (!label) return null;
        return (
          <SvgText
            key={key}
            x={fx * w}
            y={fy * h + 3}
            textAnchor="middle"
            fill="white"
            fontSize={9}
            fontWeight="700"
            opacity={0.95}
          >
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ─── Share card ───────────────────────────────────────────────────────────────

interface CardProps {
  cardWidth: number;
  teamName: string;
  opponent: string | null | undefined;
  dateLabel: string;
  batting: BatterRow[];
  innings: InningSlots[];
}

function LineupShareCard({ cardWidth, teamName, opponent, dateLabel, batting, innings }: CardProps) {
  const pad   = 16;
  const inner = cardWidth - pad * 2;
  const half  = Math.ceil(batting.length / 2);
  const col1  = batting.slice(0, half);
  const col2  = batting.slice(half);
  const dW    = (inner - 10) / 2;
  const dH    = Math.round(dW * 0.72);

  return (
    <View style={{ width: cardWidth, backgroundColor: C.bg }} collapsable={false}>

      {/* Header */}
      <View style={{ paddingTop: 28, paddingHorizontal: pad, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: C.accent, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 8 }}>
          Game Lineup
        </Text>
        <Text style={{ fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5, marginBottom: 4 }}>
          {teamName}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {opponent ? (
            <>
              <Text style={{ fontSize: 13, color: C.mutedLt }}>vs. {opponent}</Text>
              <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: C.muted }} />
            </>
          ) : null}
          <Text style={{ fontSize: 13, color: C.mutedLt }}>{dateLabel}</Text>
        </View>
      </View>

      {/* Batting order */}
      <View style={{ paddingHorizontal: pad, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Text style={{ fontSize: 9, fontWeight: '700', color: C.muted, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 10 }}>
          Batting Order
        </Text>
        {batting.length === 0 ? (
          <Text style={{ fontSize: 13, color: C.muted }}>No batting order set.</Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[col1, col2].map((col, ci) => (
              <View key={ci} style={{ flex: 1, gap: 5 }}>
                {col.map((p, i) => {
                  const num = ci === 0 ? i + 1 : half + i + 1;
                  return (
                    <View key={num} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: C.muted, width: 14, textAlign: 'right', opacity: 0.8 }}>
                        {num}
                      </Text>
                      <View style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center',
                        backgroundColor: C.surface, borderRadius: 7,
                        paddingVertical: 6, paddingHorizontal: 9,
                        borderLeftWidth: 3,
                        borderLeftColor: p.gender === 'M' ? C.male : C.female,
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: C.text }} numberOfLines={1}>
                          {p.name}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Defense */}
      <View style={{ paddingHorizontal: pad, paddingTop: 16, paddingBottom: 24 }}>
        <Text style={{ fontSize: 9, fontWeight: '700', color: C.muted, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 12 }}>
          Defense
        </Text>
        {innings.length === 0 ? (
          <Text style={{ fontSize: 13, color: C.muted }}>No defensive alignment set.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {[0, 2, 4].map((start) => (
              <View key={start} style={{ flexDirection: 'row', gap: 10 }}>
                {innings.slice(start, start + 2).map((inning, j) => (
                  <View key={j} style={{ width: dW }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                      <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 8, fontWeight: '800', color: C.accent }}>{start + j + 1}</Text>
                      </View>
                      <Text style={{ fontSize: 9, fontWeight: '600', color: C.mutedLt, letterSpacing: 0.5 }}>
                        Inning {start + j + 1}
                      </Text>
                    </View>
                    <InningDiamond slots={inning} w={dW} h={dH} id={`i${start + j}`} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 14, paddingHorizontal: pad, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
        <Ionicons name={'shield' as any} size={11} color={C.accent} />
        <Text style={{ fontSize: 10, color: C.muted }}>
          Made with <Text style={{ color: C.accent, fontWeight: '700' }}>Lineup Manager</Text>
        </Text>
      </View>

    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SharePreviewScreen() {
  const { width } = useWindowDimensions();
  const { team, players } = useTeamStore();
  const { selectedGame, activeLineupId } = useGameStore();
  const [batting, setBatting] = useState<BatterRow[]>([]);
  const [innings, setInnings] = useState<InningSlots[]>([]);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const cardRef = useRef<View>(null);

  async function captureCard(): Promise<string | null> {
    try {
      return await captureRef(cardRef, { format: 'png', quality: 1 });
    } catch {
      Alert.alert('Error', 'Could not capture the lineup card.');
      return null;
    }
  }

  async function handleShare() {
    setCapturing(true);
    try {
      const uri = await captureCard();
      if (!uri) return;
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Lineup' });
    } catch {
      Alert.alert('Error', 'Could not share the image.');
    } finally {
      setCapturing(false);
    }
  }

  useEffect(() => {
    if (!activeLineupId) { setLoading(false); return; }

    async function load() {
      const [{ data: battingRows }, { data: slotRows }] = await Promise.all([
        (supabase.from('batting_order') as any)
          .select('order_index, player_id')
          .eq('lineup_id', activeLineupId)
          .order('order_index'),
        (supabase.from('lineup_slots') as any)
          .select('inning, position, player_id')
          .eq('lineup_id', activeLineupId),
      ]);

      const playerMap = new Map(players.map((p) => [p.id, p]));

      // Batting — resolve names, skip unresolved (ghost/missing) players
      const batt: BatterRow[] = [];
      for (const row of (battingRows as any[]) ?? []) {
        const p = playerMap.get(row.player_id);
        if (p) batt.push({ name: playerName(p), gender: playerGender(p) });
      }
      setBatting(batt);

      // Build a list of all player names for dupe-detection in SVG labels
      const allNames = [...playerMap.values()].map((p) => playerName(p));

      // Defensive alignment — group by inning
      const innMap: Record<number, InningSlots> = {};
      for (const row of (slotRows as any[]) ?? []) {
        const p = playerMap.get(row.player_id);
        if (!p) continue;
        if (!innMap[row.inning]) innMap[row.inning] = {};
        innMap[row.inning][row.position] = shortName(playerName(p), allNames);
      }
      setInnings([1, 2, 3, 4, 5, 6].map((i) => innMap[i] ?? {}));
      setLoading(false);
    }

    load();
  }, [activeLineupId, players]);

  const teamName  = team?.name ?? 'My Team';
  const opponent  = selectedGame?.opponent ?? null;
  const dateLabel = selectedGame
    ? formatGameDate(selectedGame.date.slice(0, 10), selectedGame.start_time)
    : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Share Lineup',
          headerStyle: { backgroundColor: C.surface },
          headerTintColor: C.text,
          headerRight: () => (
            <TouchableOpacity onPress={handleShare} disabled={capturing} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: 4 }}>
              <Ionicons name={'share-social-outline' as any} size={22} color={capturing ? C.muted : C.text} />
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View ref={cardRef} collapsable={false}>
            <LineupShareCard
              cardWidth={width}
              teamName={teamName}
              opponent={opponent}
              dateLabel={dateLabel}
              batting={batting}
              innings={innings}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
