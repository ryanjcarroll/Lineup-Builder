import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTeamStore } from '../../../stores/teamStore';
import { useGameStore } from '../../../stores/gameStore';
import { supabase } from '../../../lib/supabase';
import { Player } from '../../../types/database';

const TEAM_ID = '00000000-0000-0000-0000-000000000001';
const SLOT_COUNT = 10;

// ─── Rules (edit here as they change) ────────────────────────────────────────
const RULE_MIN_BATTERS = 10;
const RULE_MAX_CONSECUTIVE_MALE = 3;

// ─── Validation ───────────────────────────────────────────────────────────────

interface ValidationResult {
  filledCount: number;
  consecutiveMaleViolations: number[][];  // arrays of slot indices forming each run
}

function validateOrder(slots: (Player | null)[]): ValidationResult {
  const filledCount = slots.filter(Boolean).length;
  const filled = slots
    .map((p, i) => ({ player: p, index: i }))
    .filter((s): s is { player: Player; index: number } => s.player !== null);

  const consecutiveMaleViolations: number[][] = [];

  if (filled.length === 0) return { filledCount, consecutiveMaleViolations };

  // Build a circular sequence of filled slots for wraparound check
  const doubled = [...filled, ...filled];
  let i = 0;
  while (i < filled.length) {
    if (doubled[i].player.gender !== 'M') { i++; continue; }
    let runEnd = i;
    while (runEnd < doubled.length && doubled[runEnd].player.gender === 'M') runEnd++;
    const runLen = runEnd - i;
    if (runLen > RULE_MAX_CONSECUTIVE_MALE) {
      // Collect the original slot indices of this run (de-duped for wraparound)
      const indices = doubled.slice(i, runEnd).map((s) => s.index);
      const unique = [...new Set(indices)];
      consecutiveMaleViolations.push(unique);
      i = runEnd;
    } else {
      i++;
    }
  }

  return { filledCount, consecutiveMaleViolations };
}

function buildWarnings(result: ValidationResult, slots: (Player | null)[]): string[] {
  const warnings: string[] = [];
  if (result.filledCount < RULE_MIN_BATTERS) {
    warnings.push(`Only ${result.filledCount} of ${RULE_MIN_BATTERS} batting slots filled`);
  }
  result.consecutiveMaleViolations.forEach((indices) => {
    const names = indices.map((i) => slots[i]?.name.split(' ')[0]).filter(Boolean).join(', ');
    warnings.push(`${indices.length} consecutive male batters (slots ${indices.map((i) => i + 1).join('→')}): ${names}`);
  });
  return warnings;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BattingOrderScreen() {
  const { players, fetchTeam } = useTeamStore();
  const { activeLineupId } = useGameStore();
  const navigation = useNavigation();
  const [slots, setSlots] = useState<(Player | null)[]>(Array(SLOT_COUNT).fill(null));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Track saved state as an array of player IDs so we can detect unsaved changes
  const savedSlotIds = useRef<(string | null)[]>(Array(SLOT_COUNT).fill(null));
  const hasUnsavedChanges = useRef(false);
  // Keep ref in sync on every render so the beforeRemove listener never goes stale
  hasUnsavedChanges.current = slots.some((p, i) => (p?.id ?? null) !== savedSlotIds.current[i]);

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

  // Load existing batting order when lineup changes
  useEffect(() => {
    if (!activeLineupId) { setSlots(Array(SLOT_COUNT).fill(null)); return; }
    supabase
      .from('batting_order')
      .select('order_index, player_id')
      .eq('lineup_id', activeLineupId)
      .order('order_index')
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const next = Array(SLOT_COUNT).fill(null) as (Player | null)[];
        data.forEach(({ order_index, player_id }) => {
          const player = players.find((p) => p.id === player_id);
          if (player && order_index >= 1 && order_index <= SLOT_COUNT) {
            next[order_index - 1] = player;
          }
        });
        savedSlotIds.current = next.map((p) => p?.id ?? null);
        setSlots(next);
      });
  }, [activeLineupId, players]);

  const assignedIds = new Set(slots.filter(Boolean).map((p) => p!.id));
  const availablePlayers = players.filter((p) => !assignedIds.has(p.id));

  const validation = validateOrder(slots);
  const warnings = buildWarnings(validation, slots);
  const violatingIndices = new Set(validation.consecutiveMaleViolations.flat());

  function handleSlotPress(index: number) {
    if (selectedIndex !== null) {
      if (selectedIndex === index) {
        setSelectedIndex(null);
      } else {
        const newSlots = [...slots];
        [newSlots[selectedIndex], newSlots[index]] = [newSlots[index], newSlots[selectedIndex]];
        setSlots(newSlots);
        setSelectedIndex(null);
      }
      return;
    }

    if (slots[index]) {
      setSelectedIndex(index);
    } else {
      setPickerTargetIndex(index);
      setPickerOpen(true);
    }
  }

  function handlePickPlayer(player: Player) {
    if (pickerTargetIndex === null) return;
    const newSlots = [...slots];
    newSlots[pickerTargetIndex] = player;
    setSlots(newSlots);
    setPickerOpen(false);
    setPickerTargetIndex(null);
  }

  function handleClearSlot(index: number) {
    const newSlots = [...slots];
    newSlots[index] = null;
    setSlots(newSlots);
    setSelectedIndex(null);
  }

  async function doSave() {
    if (!activeLineupId) return;
    setSaving(true);
    try {
      await supabase.from('batting_order').delete().eq('lineup_id', activeLineupId);
      const rows = slots
        .map((player, i) =>
          player ? { lineup_id: activeLineupId, order_index: i + 1, player_id: player.id } : null
        )
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (rows.length > 0) {
        await supabase.from('batting_order').insert(rows);
      }
      savedSlotIds.current = slots.map((p) => p?.id ?? null);
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

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
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
          onPress={() =>
            Alert.alert(
              'Batting Order Issues',
              warnings.map((w) => `• ${w}`).join('\n\n')
            )
          }
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

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {slots.map((player, index) => {
          const isSelected = selectedIndex === index;
          const isSwapTarget = selectedIndex !== null && !isSelected;
          const isViolating = player !== null && violatingIndices.has(index);

          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleSlotPress(index)}
              activeOpacity={0.7}
              style={isSwapTarget ? { borderStyle: 'dashed' } : undefined}
              className={`flex-row items-center bg-white rounded-xl mb-2 px-4 py-3 border shadow-sm ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : isSwapTarget
                  ? 'border-blue-300'
                  : isViolating
                  ? 'border-yellow-300 bg-yellow-50'
                  : 'border-gray-100'
              }`}
            >
              <View
                className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                  isSelected ? 'bg-blue-500' : isViolating ? 'bg-yellow-200' : 'bg-gray-100'
                }`}
              >
                <Text
                  className={`font-bold text-sm ${
                    isSelected ? 'text-white' : isViolating ? 'text-yellow-800' : 'text-gray-500'
                  }`}
                >
                  {index + 1}
                </Text>
              </View>

              {player ? (
                <View className="flex-1 flex-row items-center justify-between">
                  <Text
                    className={`font-semibold text-base ${
                      isSelected ? 'text-blue-700' : isViolating ? 'text-yellow-900' : 'text-gray-900'
                    }`}
                  >
                    {player.name}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    {isViolating && !isSelected && (
                      <Ionicons name={'warning' as any} size={14} color="#CA8A04" />
                    )}
                    <View
                      className={`px-2 py-0.5 rounded-full ${
                        player.gender === 'F' ? 'bg-pink-100' : 'bg-blue-100'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          player.gender === 'F' ? 'text-pink-700' : 'text-blue-700'
                        }`}
                      >
                        {player.gender === 'F' ? 'W' : 'M'}
                      </Text>
                    </View>
                    {!isSelected && (
                      <TouchableOpacity
                        onPress={() => handleClearSlot(index)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text className="text-gray-300 text-lg leading-none">×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : (
                <Text className="text-gray-400 text-sm">Tap to add player</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="slide">
        <View className="flex-1 justify-end">
          <TouchableOpacity className="flex-1" onPress={() => setPickerOpen(false)} />
          <View className="bg-white rounded-t-2xl" style={{ maxHeight: 420 }}>
            <View className="px-4 py-4 border-b border-gray-100 flex-row items-center justify-between">
              <Text className="font-bold text-gray-900 text-base">
                Batting #{(pickerTargetIndex ?? 0) + 1}
              </Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)}>
                <Text className="text-blue-600 font-medium">Cancel</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={availablePlayers}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handlePickPlayer(item)}
                  className="flex-row items-center px-4 py-3 border-b border-gray-50"
                >
                  <Text className="flex-1 font-medium text-gray-900 text-base">{item.name}</Text>
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
              )}
              ListEmptyComponent={
                <Text className="text-center text-gray-400 py-8">All players assigned</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
