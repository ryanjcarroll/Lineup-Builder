import { useWindowDimensions, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Polygon as SvgPolygon, Rect as SvgRect, Text as SvgText,
  Line as SvgLine, Path as SvgPath, Defs, ClipPath,
} from 'react-native-svg';

// ─── Dummy data ───────────────────────────────────────────────────────────────

const TEAM     = 'Thunder Hawks';
const OPPONENT = 'Riverside Rebels';
const DATE_STR = 'Sat, Jun 21 · 6:30 PM';

const BATTING: { name: string; gender: 'M' | 'F' }[] = [
  { name: 'Sarah K.',  gender: 'F' },
  { name: 'John M.',   gender: 'M' },
  { name: 'Lisa R.',   gender: 'F' },
  { name: 'Tom B.',    gender: 'M' },
  { name: 'Mike D.',   gender: 'M' },
  { name: 'Emma S.',   gender: 'F' },
  { name: 'Ryan C.',   gender: 'M' },
  { name: 'Jake W.',   gender: 'M' },
  { name: 'Anna P.',   gender: 'F' },
  { name: 'Chris L.',  gender: 'M' },
];

const INNINGS: Record<string, string>[] = [
  { P: 'Chris', C: 'Emma',  '1B': 'John', '2B': 'Ryan',  '3B': 'Jake',  SS: 'Tom',   LF: 'Lisa',  LC: 'Sarah', RC: 'Anna',  RF: 'Mike'  },
  { P: 'Sarah', C: 'Emma',  '1B': 'John', '2B': 'Ryan',  '3B': 'Jake',  SS: 'Tom',   LF: 'Lisa',  LC: 'Mike',  RC: 'Anna',  RF: 'Chris' },
  { P: 'Mike',  C: 'Emma',  '1B': 'Tom',  '2B': 'Ryan',  '3B': 'Jake',  SS: 'John',  LF: 'Lisa',  LC: 'Chris', RC: 'Anna',  RF: 'Sarah' },
  { P: 'Chris', C: 'Anna',  '1B': 'John', '2B': 'Ryan',  '3B': 'Jake',  SS: 'Tom',   LF: 'Lisa',  LC: 'Sarah', RC: 'Mike',  RF: 'Emma'  },
  { P: 'Sarah', C: 'Emma',  '1B': 'Tom',  '2B': 'Chris', '3B': 'Jake',  SS: 'John',  LF: 'Lisa',  LC: 'Mike',  RC: 'Anna',  RF: 'Ryan'  },
  { P: 'Mike',  C: 'Emma',  '1B': 'John', '2B': 'Ryan',  '3B': 'Chris', SS: 'Tom',   LF: 'Lisa',  LC: 'Sarah', RC: 'Anna',  RF: 'Jake'  },
];

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:       '#0F172A',
  surface:  '#1E293B',
  border:   '#334155',
  accent:   '#3B82F6',
  text:     '#F1F5F9',
  muted:    '#64748B',
  mutedLt:  '#94A3B8',
  male:     '#60A5FA',
  female:   '#F472B6',
  field:    '#14532D',
  infield:  '#1D4D35',
  dirt:     '#92400E',
  dirtLt:   '#B45309',
} as const;

// ─── Mini diamond SVG ─────────────────────────────────────────────────────────

// Fractional positions matching positions.tsx layout
const FIELD_POS = [
  { key: 'LF',  fx: 0.18, fy: 0.14 },
  { key: 'LC',  fx: 0.39, fy: 0.11 },
  { key: 'RC',  fx: 0.61, fy: 0.11 },
  { key: 'RF',  fx: 0.82, fy: 0.14 },
  { key: 'SS',  fx: 0.37, fy: 0.47 },
  { key: '2B',  fx: 0.63, fy: 0.47 },
  { key: '3B',  fx: 0.21, fy: 0.61 },
  { key: '1B',  fx: 0.79, fy: 0.61 },
  { key: 'P',   fx: 0.50, fy: 0.68 },
  { key: 'C',   fx: 0.50, fy: 0.93 },
] as const;

function InningDiamond({ assignments, w, h, id }: { assignments: Record<string, string>; w: number; h: number; id: string }) {
  // Diamond geometry
  const cx = w / 2;
  const homeY  = h * 0.87;
  const d      = h * 0.185;
  const firstX = cx + d, firstY = homeY - d;
  const secX   = cx,     secY   = homeY - 2 * d;
  const thirdX = cx - d, thirdY = homeY - d;
  // Foul lines extend at the same 45° angle as home→1B and home→3B
  const foulEndY = homeY - cx;   // cx = w/2, so Δy = Δx for 45°
  // Circular arc centered at home plate; equidistant from 1B/3B and 2B
  const r        = d * 2.5;
  const arcEndY  = homeY - r / Math.SQRT2;
  const arcLX    = cx    - r / Math.SQRT2;
  const arcRX    = cx    + r / Math.SQRT2;
  const arcR     = r * 0.78; // smaller than r → more curved apex

  const diamondPts = `${cx},${homeY} ${firstX},${firstY} ${secX},${secY} ${thirdX},${thirdY}`;

  // Fair-territory clip: wedge between the two foul lines
  const fairPts = `${cx},${homeY} 0,${foulEndY} 0,0 ${w},0 ${w},${foulEndY}`;
  const clipId  = `ft-${id}`;

  return (
    <Svg width={w} height={h}>
      <Defs>
        <ClipPath id={clipId}>
          <SvgPolygon points={fairPts} />
        </ClipPath>
      </Defs>

      {/* Field background */}
      <SvgRect x={0} y={0} width={w} height={h} fill={C.field} rx={6} />

      {/* Foul lines — 45°, aligned with the diamond edges */}
      <SvgLine x1={cx} y1={homeY} x2={0} y2={foulEndY} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
      <SvgLine x1={cx} y1={homeY} x2={w} y2={foulEndY} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />

      {/* Infield dirt fill — arc down to home, single layer so opacity is consistent */}
      <SvgPath
        d={`M ${arcLX},${arcEndY} A ${arcR},${arcR} 0 0 1 ${arcRX},${arcEndY} L ${cx},${homeY} Z`}
        clipPath={`url(#${clipId})`}
        fill={C.dirt}
        opacity={0.55}
        stroke="none"
      />

      {/* Outfield arc */}
      <SvgPath
        d={`M ${arcLX},${arcEndY} A ${arcR},${arcR} 0 0 1 ${arcRX},${arcEndY}`}
        clipPath={`url(#${clipId})`}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1}
        fill="none"
      />

      {/* Base paths */}
      <SvgPolygon points={diamondPts} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={0.8} />

      {/* Player names */}
      {FIELD_POS.map(({ key, fx, fy }) => {
        const name = assignments[key];
        if (!name) return null;
        const x = fx * w;
        const y = fy * h;
        const short = name.length > 5 ? name.slice(0, 5) : name;
        return (
          <SvgText
            key={key}
            x={x}
            y={y + 3}
            textAnchor="middle"
            fill="white"
            fontSize={9}
            fontWeight="700"
            opacity={0.95}
          >
            {short}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ─── Share card ───────────────────────────────────────────────────────────────

function LineupShareCard({ cardWidth }: { cardWidth: number }) {
  const pad   = 16;
  const inner = cardWidth - pad * 2;

  // Batting order: two columns
  const half = Math.ceil(BATTING.length / 2);
  const col1 = BATTING.slice(0, half);
  const col2 = BATTING.slice(half);

  // Diamonds: 2 columns × 3 rows
  const dW = (inner - 10) / 2;
  const dH = Math.round(dW * 0.72);

  return (
    <View style={{ width: cardWidth, backgroundColor: C.bg }} collapsable={false}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={{ paddingTop: 28, paddingHorizontal: pad, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: C.accent, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 8 }}>
          Game Lineup
        </Text>
        <Text style={{ fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5, marginBottom: 4 }}>
          {TEAM}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13, color: C.mutedLt }}>vs. {OPPONENT}</Text>
          <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: C.muted }} />
          <Text style={{ fontSize: 13, color: C.mutedLt }}>{DATE_STR}</Text>
        </View>
      </View>

      {/* ── Batting order ─────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: pad, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Text style={{ fontSize: 9, fontWeight: '700', color: C.muted, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 10 }}>
          Batting Order
        </Text>
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
      </View>

      {/* ── Defense ───────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: pad, paddingTop: 16, paddingBottom: 24 }}>
        <Text style={{ fontSize: 9, fontWeight: '700', color: C.muted, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 12 }}>
          Defense
        </Text>
        <View style={{ gap: 10 }}>
          {[0, 2, 4].map((start) => (
            <View key={start} style={{ flexDirection: 'row', gap: 10 }}>
              {INNINGS.slice(start, start + 2).map((inning, j) => (
                <View key={j} style={{ width: dW }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 8, fontWeight: '800', color: C.accent }}>{start + j + 1}</Text>
                    </View>
                    <Text style={{ fontSize: 9, fontWeight: '600', color: C.mutedLt, letterSpacing: 0.5 }}>
                      Inning {start + j + 1}
                    </Text>
                  </View>
                  <InningDiamond assignments={inning} w={dW} h={dH} id={`i${start + j}`} />
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* ── Footer ────────────────────────────────────────────────────── */}
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Export Preview',
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.text,
        }}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <LineupShareCard cardWidth={width} />
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border }}>
        <TouchableOpacity
          onPress={() => Alert.alert('Coming soon', 'Image capture will be wired up when this is integrated into the app.')}
          style={{ backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
        >
          <Ionicons name={'share-outline' as any} size={18} color="white" />
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Share Image</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
