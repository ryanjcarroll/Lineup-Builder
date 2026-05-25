import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useTeamStore } from '../stores/teamStore';
import { supabase } from '../lib/supabase';
import { TeamRules } from '../types/database';

// ─── Defaults (source of truth for unset rules) ───────────────────────────────
export const DEFAULT_RULES: TeamRules = {
  players_in_field: 10,
  field_positions: [],
  min_players_to_play: 6,
  min_women_to_play: 1,
  min_female_in_field: 3,
  max_consecutive_male_batting: 3,
};

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({
  value, min = 0, max = 20, onChange,
}: {
  value: number; min?: number; max?: number; onChange: (v: number) => void;
}) {
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <TouchableOpacity
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={atMin}
        style={{
          width: 34, height: 34, borderRadius: 17,
          backgroundColor: atMin ? '#F3F4F6' : '#EFF6FF',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 20, lineHeight: 24, color: atMin ? '#D1D5DB' : '#2563EB' }}>−</Text>
      </TouchableOpacity>
      <Text style={{ width: 34, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#111827' }}>
        {value}
      </Text>
      <TouchableOpacity
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={atMax}
        style={{
          width: 34, height: 34, borderRadius: 17,
          backgroundColor: atMax ? '#F3F4F6' : '#EFF6FF',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 20, lineHeight: 24, color: atMax ? '#D1D5DB' : '#2563EB' }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  return (
    <Text style={{
      fontSize: 11, fontWeight: '700', color: '#9CA3AF',
      textTransform: 'uppercase', letterSpacing: 0.8,
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
    }}>
      {title}
    </Text>
  );
}

// ─── Rule row ─────────────────────────────────────────────────────────────────

function RuleRow({
  label, description, children,
}: {
  label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    }}>
      <View style={{ flex: 1, marginRight: 16 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>{label}</Text>
        {description && (
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{description}</Text>
        )}
      </View>
      {children}
    </View>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function EditRulesModal({ visible, onClose }: Props) {
  const { team, fetchTeam } = useTeamStore();
  const rules = team?.rules;

  const [minTotal, setMinTotal] = useState(DEFAULT_RULES.min_players_to_play);
  const [minWomen, setMinWomen] = useState(DEFAULT_RULES.min_women_to_play);
  const [minWomenField, setMinWomenField] = useState(DEFAULT_RULES.min_female_in_field);
  const [maxConsecMen, setMaxConsecMen] = useState(DEFAULT_RULES.max_consecutive_male_batting);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && rules) {
      setMinTotal(rules.min_players_to_play ?? DEFAULT_RULES.min_players_to_play);
      setMinWomen(rules.min_women_to_play ?? DEFAULT_RULES.min_women_to_play);
      setMinWomenField(rules.min_female_in_field ?? DEFAULT_RULES.min_female_in_field);
      setMaxConsecMen(rules.max_consecutive_male_batting ?? DEFAULT_RULES.max_consecutive_male_batting);
    }
  }, [visible]);

  async function handleSave() {
    if (!team) return;
    setSaving(true);
    try {
      const updatedRules: TeamRules = {
        ...(rules ?? DEFAULT_RULES),
        min_players_to_play: minTotal,
        min_women_to_play: minWomen,
        min_female_in_field: minWomenField,
        max_consecutive_male_batting: maxConsecMen,
      };
      await supabase.from('teams').update({ rules: updatedRules }).eq('id', team.id);
      await fetchTeam(team.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{ backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' }}>
          {/* Drag handle */}
          <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 12 }} />

          {/* Title */}
          <Text style={{
            fontSize: 17, fontWeight: '700', color: '#111827',
            textAlign: 'center', paddingVertical: 16,
          }}>
            Edit League Rules
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <SectionLabel title="League Rules" />

            {/* Minimum players to play — two steppers */}
            <View style={{
              paddingHorizontal: 20, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
            }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 14 }}>
                Minimum players to play
              </Text>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '500', color: '#6B7280' }}>Total</Text>
                  <Stepper value={minTotal} min={1} max={20} onChange={setMinTotal} />
                </View>
                <View style={{ width: 1, backgroundColor: '#F3F4F6' }} />
                <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '500', color: '#6B7280' }}>Women</Text>
                  <Stepper value={minWomen} min={0} max={10} onChange={setMinWomen} />
                </View>
              </View>
            </View>

            <RuleRow label="Minimum women in field" description="Per inning on defense">
              <Stepper value={minWomenField} min={0} max={10} onChange={setMinWomenField} />
            </RuleRow>

            <RuleRow label="Maximum consecutive men" description="Batting order, including wraparound">
              <Stepper value={maxConsecMen} min={1} max={10} onChange={setMaxConsecMen} />
            </RuleRow>

            {/* Save button */}
            <View style={{ padding: 20, paddingBottom: 36 }}>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={{
                  backgroundColor: '#2563EB', borderRadius: 12,
                  paddingVertical: 14, alignItems: 'center',
                }}
              >
                {saving
                  ? <ActivityIndicator color="white" />
                  : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
