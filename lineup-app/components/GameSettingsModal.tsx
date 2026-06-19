import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Game } from '../types/database';
import { useGameStore } from '../stores/gameStore';

export type DefensiveMode = 'all_game' | 'per_inning' | 'grouped';

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ value, min = 1, max = 20, onChange }: {
  value: number; min?: number; max?: number; onChange: (v: number) => void;
}) {
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <TouchableOpacity
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={atMin}
        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: atMin ? '#E5E7EB' : '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 20, lineHeight: 24, color: atMin ? '#D1D5DB' : '#2563EB' }}>−</Text>
      </TouchableOpacity>
      <Text style={{ width: 34, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#111827' }}>{value}</Text>
      <TouchableOpacity
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={atMax}
        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: atMax ? '#E5E7EB' : '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 20, lineHeight: 24, color: atMax ? '#D1D5DB' : '#2563EB' }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildGroupPreview(innings: number, size: number): string {
  const groups: string[] = [];
  for (let i = 1; i <= innings; i += size) {
    const end = Math.min(i + size - 1, innings);
    groups.push(i === end ? `${i}` : `${i}–${end}`);
  }
  return groups.join(' · ');
}

// ─── Radio option row ─────────────────────────────────────────────────────────

function RadioRow({
  selected, onPress, label, description, children,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row', alignItems: 'flex-start',
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
        gap: 12,
      }}
    >
      <View style={{
        width: 22, height: 22, borderRadius: 11, borderWidth: 2,
        borderColor: selected ? '#2563EB' : '#D1D5DB',
        backgroundColor: selected ? '#2563EB' : 'white',
        alignItems: 'center', justifyContent: 'center',
        marginTop: 1,
        flexShrink: 0,
      }}>
        {selected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'white' }} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>{label}</Text>
        {description && (
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{description}</Text>
        )}
        {children}
      </View>
    </TouchableOpacity>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  game: Game;
}

export default function GameSettingsModal({ visible, onClose, game }: Props) {
  const { updateGame } = useGameStore();

  const [innings, setInnings] = useState(game.innings_count ?? 6);
  const [defensiveMode, setDefensiveMode] = useState<DefensiveMode>('per_inning');
  const [groupSize, setGroupSize] = useState(2);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setInnings(game.innings_count ?? 6);
      setDefensiveMode(game.defensive_mode ?? 'per_inning');
      setGroupSize(game.defensive_group_size ?? 2);
    }
  }, [visible, game]);

  const groupPreview = buildGroupPreview(innings, groupSize);

  async function handleSave() {
    setSaving(true);
    try {
      await updateGame(game.id, {
        innings_count: innings,
        defensive_mode: defensiveMode,
        defensive_group_size: groupSize,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{ backgroundColor: '#F3F4F6', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' }}>
          {/* Drag handle */}
          <View style={{ width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginTop: 12 }} />

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>Game Settings</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={'close' as any} size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* ── Innings ──────────────────────────────────────────────── */}
            <Text style={{
              fontSize: 11, fontWeight: '700', color: '#9CA3AF',
              textTransform: 'uppercase', letterSpacing: 0.8,
              paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
            }}>
              Game Length
            </Text>

            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 20, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
              backgroundColor: 'white',
            }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>Number of Innings</Text>
              </View>
              <Stepper value={innings} min={1} max={9} onChange={setInnings} />
            </View>

            {/* ── Defensive Mode ───────────────────────────────────────── */}
            <Text style={{
              fontSize: 11, fontWeight: '700', color: '#9CA3AF',
              textTransform: 'uppercase', letterSpacing: 0.8,
              paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
            }}>
              Defensive Mode
            </Text>

            <View style={{ backgroundColor: 'white' }}>
              <RadioRow
                selected={defensiveMode === 'all_game'}
                onPress={() => setDefensiveMode('all_game')}
                label="One alignment all game"
                description="All innings share the same defensive positions"
              />

              <RadioRow
                selected={defensiveMode === 'per_inning'}
                onPress={() => setDefensiveMode('per_inning')}
                label="Rotate every inning"
                description="Set a unique defensive alignment for each inning"
              />

              <RadioRow
                selected={defensiveMode === 'grouped'}
                onPress={() => setDefensiveMode('grouped')}
                label="Rotate every few innings"
              >
                {defensiveMode === 'grouped' && (
                  <View style={{ marginTop: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 13, color: '#6B7280' }}>Rotate every</Text>
                      <Stepper value={groupSize} min={2} max={Math.max(2, innings - 1)} onChange={setGroupSize} />
                      <Text style={{ fontSize: 13, color: '#6B7280' }}>innings</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: '#2563EB', marginTop: 8, fontWeight: '500' }}>
                      {groupPreview}
                    </Text>
                  </View>
                )}
              </RadioRow>
            </View>

            {/* ── Save ─────────────────────────────────────────────────── */}
            <View style={{ padding: 20, paddingBottom: 36 }}>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={{ backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
              >
                {saving
                  ? <ActivityIndicator color="white" />
                  : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
