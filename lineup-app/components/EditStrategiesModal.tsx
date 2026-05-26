import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTeamStore } from '../stores/teamStore';
import { supabase } from '../lib/supabase';
import { DEFAULT_RULES } from './EditRulesModal';

// Expanded position list — includes CF for 3-outfielder consolidations
const STRATEGY_POSITIONS = ['LF', 'LC', 'CF', 'RC', 'RF', 'SS', '2B', '3B', '1B', 'P', 'C'];

export const DEFAULT_STRATEGIES: Record<number, string[]> = {
  6:  ['P', 'C', '1B', 'SS', 'LC', 'RC'],
  7:  ['P', 'C', '1B', 'SS', 'LF', 'CF', 'RF'],
  8:  ['P', 'C', '1B', '2B', '3B', 'LF', 'CF', 'RF'],
  9:  ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'],
  10: ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'LC', 'RC', 'RF'],
};

export default function EditStrategiesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { team, fetchTeam } = useTeamStore();
  const rules = team?.rules;

  const maxField = rules?.players_in_field  ?? DEFAULT_RULES.players_in_field;
  const minField = rules?.min_players_to_play ?? DEFAULT_RULES.min_players_to_play;

  const [strategies, setStrategies] = useState<Record<number, string[]>>({});
  const [saving, setSaving] = useState(false);
  const savedJson = useRef('');

  useEffect(() => {
    if (visible) {
      const loaded = (rules?.strategies as Record<number, string[]>) ?? DEFAULT_STRATEGIES;
      setStrategies(loaded);
      savedJson.current = JSON.stringify(loaded);
    }
  }, [visible]);

  const hasUnsavedChanges = JSON.stringify(strategies) !== savedJson.current;

  function handleClose() {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Unsaved Changes',
        'Leave without saving your strategy changes?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: onClose },
        ]
      );
    } else {
      onClose();
    }
  }

  function togglePosition(count: number, pos: string) {
    setStrategies((prev) => {
      const current = prev[count] ?? [];
      if (current.includes(pos)) {
        return { ...prev, [count]: current.filter((p) => p !== pos) };
      }
      if (current.length >= count) return prev;
      return { ...prev, [count]: [...current, pos] };
    });
  }

  async function handleSave() {
    if (!team) return;
    setSaving(true);
    try {
      const updatedRules = { ...(rules ?? DEFAULT_RULES), strategies };
      await (supabase.from('teams') as any).update({ rules: updatedRules }).eq('id', team.id);
      await fetchTeam(team.id);
      savedJson.current = JSON.stringify(strategies);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // One section per count from min up to and including max
  const counts = Array.from({ length: Math.max(0, maxField - minField + 1) }, (_, i) => minField + i);

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>

        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#1E40AF',
        }}>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={'chevron-back' as any} size={26} color="white" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '700', color: 'white' }}>Edit Strategies</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {saving
              ? <ActivityIndicator color="white" size="small" />
              : <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 13, color: '#6B7280', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, lineHeight: 19 }}>
            Select which positions are active for each fielder count. Tap a position to add it — selections are limited to the fielder count for that row.
          </Text>

          {counts.length === 0 ? (
            <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingTop: 40 }}>
              No reduced fielder counts — adjust Min/Max in Edit Rules.
            </Text>
          ) : (
            counts.map((count) => {
              const selected = strategies[count] ?? [];
              const isFull = selected.length >= count;

              return (
                <View key={count} style={{ marginTop: 20 }}>
                  {/* Section header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      {count} Fielders
                    </Text>
                    <Text style={{
                      fontSize: 12, fontWeight: '600',
                      color: selected.length === count ? '#16A34A' : selected.length > 0 ? '#2563EB' : '#9CA3AF',
                    }}>
                      {selected.length} / {count}
                    </Text>
                  </View>

                  {/* Position chips */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 }}>
                    {STRATEGY_POSITIONS.map((pos) => {
                      const isSelected = selected.includes(pos);
                      const isDisabled = isFull && !isSelected;
                      return (
                        <TouchableOpacity
                          key={pos}
                          onPress={() => togglePosition(count, pos)}
                          activeOpacity={isDisabled ? 1 : 0.7}
                          style={{
                            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                            backgroundColor: isSelected ? '#DBEAFE' : 'white',
                            borderWidth: 1.5,
                            borderColor: isSelected ? '#2563EB' : '#E5E7EB',
                            opacity: isDisabled ? 0.35 : 1,
                          }}
                        >
                          <Text style={{
                            fontSize: 14, fontWeight: '600',
                            color: isSelected ? '#1D4ED8' : '#9CA3AF',
                          }}>
                            {pos}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })
          )}

          {/* Reset to defaults */}
          <View style={{ paddingHorizontal: 16, paddingTop: 32, paddingBottom: 8 }}>
            <TouchableOpacity
              onPress={() => setStrategies(DEFAULT_STRATEGIES)}
              style={{
                borderRadius: 12, paddingVertical: 14, alignItems: 'center',
                borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: 'white',
              }}
            >
              <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 15 }}>Reset to Defaults</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
