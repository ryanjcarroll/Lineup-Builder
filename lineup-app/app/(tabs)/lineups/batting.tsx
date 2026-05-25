import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, FlatList, ActivityIndicator, Alert,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GenderCorner from '../../../components/GenderCorner';
import { useTeamStore } from '../../../stores/teamStore';
import { useGameStore } from '../../../stores/gameStore';
import { DEFAULT_RULES } from '../../../components/EditRulesModal';
import { supabase } from '../../../lib/supabase';
import { Player } from '../../../types/database';

const TEAM_ID = '00000000-0000-0000-0000-000000000001';
const MIN_SLOT_COUNT = 1;

// ─── Validation ───────────────────────────────────────────────────────────────

interface ValidationResult {
  filledCount: number;
  hasEmptySlots: boolean;
  consecutiveMaleViolations: number[][];
}

function validateOrder(slots: (Player | null)[], maxConsecMen: number): ValidationResult {
  const filledCount = slots.filter(Boolean).length;
  const hasEmptySlots = filledCount < slots.length;
  const filled = slots
    .map((p, i) => ({ player: p, index: i }))
    .filter((s): s is { player: Player; index: number } => s.player !== null);

  const consecutiveMaleViolations: number[][] = [];
  if (filled.length === 0) return { filledCount, hasEmptySlots, consecutiveMaleViolations };

  const doubled = [...filled, ...filled];
  let i = 0;
  while (i < filled.length) {
    if (doubled[i].player.gender !== 'M') { i++; continue; }
    let runEnd = i;
    while (runEnd < doubled.length && doubled[runEnd].player.gender === 'M') runEnd++;
    const runLen = runEnd - i;
    if (runLen > maxConsecMen) {
      const indices = [...new Set(doubled.slice(i, runEnd).map((s) => s.index))];
      consecutiveMaleViolations.push(indices);
      i = runEnd;
    } else {
      i++;
    }
  }

  return { filledCount, hasEmptySlots, consecutiveMaleViolations };
}

function buildWarnings(
  result: ValidationResult,
  slots: (Player | null)[],
  minBatters: number,
  maxConsecMen: number,
): string[] {
  const warnings: string[] = [];
  if (slots.length < minBatters) {
    warnings.push(`Batting order has only ${slots.length} slot${slots.length !== 1 ? 's' : ''} (minimum is ${minBatters})`);
  }
  if (result.hasEmptySlots) {
    const empty = slots.length - result.filledCount;
    warnings.push(`${empty} slot${empty !== 1 ? 's' : ''} ${empty !== 1 ? 'are' : 'is'} unfilled`);
  }
  result.consecutiveMaleViolations.forEach((indices) => {
    const names = indices.map((i) => slots[i]?.name.split(' ')[0]).filter(Boolean).join(', ');
    warnings.push(`${indices.length} consecutive male batters (slots ${indices.map((i) => i + 1).join('→')}): ${names}`);
  });
  return warnings;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BattingOrderScreen() {
  const { team, players, fetchTeam } = useTeamStore();
  const { activeLineupId, selectedGame } = useGameStore();
  const rules = team?.rules;
  const maxConsecMen = rules?.max_consecutive_male_batting ?? DEFAULT_RULES.max_consecutive_male_batting;
  const minBatters   = rules?.min_players_to_play         ?? DEFAULT_RULES.min_players_to_play;
  const navigation = useNavigation();

  const [slots, setSlots] = useState<(Player | null)[]>(Array(DEFAULT_RULES.min_players_to_play).fill(null));
  const [subs, setSubs] = useState<Player[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Sub-add form (shown inside the picker modal)
  const [addingSubMode, setAddingSubMode] = useState(false);
  const [subName, setSubName] = useState('');
  const [subGender, setSubGender] = useState<'M' | 'F'>('M');
  const [savingSub, setSavingSub] = useState(false);

  // Unsaved-changes tracking: compare slot IDs (including length) as JSON
  const savedSlotJson = useRef<string>(JSON.stringify([]));
  const hasUnsavedChanges = useRef(false);
  hasUnsavedChanges.current =
    JSON.stringify(slots.map((p) => p?.id ?? null)) !== savedSlotJson.current;

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

  // Load batting order + subs when lineup/players change
  useEffect(() => {
    if (!activeLineupId) {
      setSlots(Array(Math.max(players.length, minBatters)).fill(null));
      setSubs([]);
      savedSlotJson.current = JSON.stringify([]);
      return;
    }

    async function load() {
      // Fetch subs for this game
      let gameSubs: Player[] = [];
      if (selectedGame) {
        const { data: guestRefs } = await supabase
          .from('game_roster')
          .select('player_id')
          .eq('game_id', selectedGame.id)
          .eq('is_guest', true);
        const guestIds = guestRefs?.map((r) => r.player_id) ?? [];
        if (guestIds.length > 0) {
          const { data } = await supabase
            .from('players')
            .select('*, position_preferences(*)')
            .in('id', guestIds);
          gameSubs = (data as Player[]) ?? [];
        }
      }
      setSubs(gameSubs);

      // Fetch batting order
      const { data: orders } = await supabase
        .from('batting_order')
        .select('order_index, player_id')
        .eq('lineup_id', activeLineupId)
        .order('order_index');

      const allPlayers = [...players, ...gameSubs];

      if (!orders || orders.length === 0) {
        const defaultSlots = Array(Math.max(allPlayers.length, minBatters)).fill(null);
        setSlots(defaultSlots);
        savedSlotJson.current = JSON.stringify(defaultSlots.map(() => null));
        return;
      }

      const maxIndex = Math.max(...orders.map((o) => o.order_index));
      const next = Array(maxIndex).fill(null) as (Player | null)[];
      orders.forEach(({ order_index, player_id }) => {
        const player = allPlayers.find((p) => p.id === player_id);
        if (player && order_index >= 1 && order_index <= maxIndex) {
          next[order_index - 1] = player;
        }
      });
      savedSlotJson.current = JSON.stringify(next.map((p) => p?.id ?? null));
      setSlots(next);
    }

    load();
  }, [activeLineupId, players]);

  const assignedIds = new Set(slots.filter(Boolean).map((p) => p!.id));
  const availablePlayers = players.filter((p) => !assignedIds.has(p.id));
  const availableSubs = subs.filter((p) => !assignedIds.has(p.id));

  const validation = validateOrder(slots, maxConsecMen);
  const warnings = buildWarnings(validation, slots, minBatters, maxConsecMen);
  const violatingIndices = new Set(validation.consecutiveMaleViolations.flat());

  // ── Slot count controls ──────────────────────────────────────────────────────

  function addSlot() {
    setSlots((prev) => [...prev, null]);
  }

  function removeLastSlot() {
    if (slots.length <= MIN_SLOT_COUNT) return;
    setSlots((prev) => prev.slice(0, -1));
    setSelectedIndex(null);
  }

  // ── Player selection ─────────────────────────────────────────────────────────

  function handleSlotPress(index: number) {
    if (selectedIndex !== null) {
      if (selectedIndex === index) { setSelectedIndex(null); return; }
      const newSlots = [...slots];
      [newSlots[selectedIndex], newSlots[index]] = [newSlots[index], newSlots[selectedIndex]];
      setSlots(newSlots);
      setSelectedIndex(null);
      return;
    }
    if (slots[index]) {
      setSelectedIndex(index);
    } else {
      setPickerTargetIndex(index);
      setAddingSubMode(false);
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

  // ── Sub creation ─────────────────────────────────────────────────────────────

  async function handleAddSub() {
    if (!subName.trim() || !selectedGame) return;
    setSavingSub(true);
    try {
      const { data: newPlayer, error } = await supabase
        .from('players')
        .insert({ team_id: TEAM_ID, name: subName.trim(), gender: subGender, is_active: false })
        .select('*, position_preferences(*)')
        .single();
      if (error || !newPlayer) return;

      await supabase
        .from('game_roster')
        .insert({ game_id: selectedGame.id, player_id: newPlayer.id, is_guest: true });

      const sub = newPlayer as Player;
      setSubs((prev) => [...prev, sub]);
      setSubName('');
      setSubGender('M');
      setAddingSubMode(false);

      // Auto-assign to the pending slot
      if (pickerTargetIndex !== null) {
        const newSlots = [...slots];
        newSlots[pickerTargetIndex] = sub;
        setSlots(newSlots);
        setPickerOpen(false);
        setPickerTargetIndex(null);
      }
    } finally {
      setSavingSub(false);
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

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
      if (rows.length > 0) await supabase.from('batting_order').insert(rows);
      savedSlotJson.current = JSON.stringify(slots.map((p) => p?.id ?? null));
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

  // ── Render ───────────────────────────────────────────────────────────────────

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
          onPress={() => Alert.alert('Batting Order Issues', warnings.map((w) => `• ${w}`).join('\n\n'))}
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

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">

        {/* Headcount control */}
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: 'white', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16,
          borderWidth: 1.5, borderColor: '#4B5563', width: '55%',
        }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
            {slots.length} Batter{slots.length !== 1 ? 's' : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TouchableOpacity
              onPress={removeLastSlot}
              disabled={slots.length <= MIN_SLOT_COUNT}
              style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: slots.length <= MIN_SLOT_COUNT ? '#F3F4F6' : '#EFF6FF',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name={'remove' as any} size={18} color={slots.length <= MIN_SLOT_COUNT ? '#D1D5DB' : '#2563EB'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={addSlot}
              style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name={'add' as any} size={18} color="#2563EB" />
            </TouchableOpacity>
          </View>
        </View>
        </View>

        {/* Batting slots */}
        {slots.map((player, index) => {
          const isSelected = selectedIndex === index;
          const isSwapTarget = selectedIndex !== null && !isSelected;
          const isViolating = player !== null && violatingIndices.has(index);
          const isSub = player !== null && subs.some((s) => s.id === player.id);

          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleSlotPress(index)}
              activeOpacity={0.7}
              style={[isSwapTarget ? { borderStyle: 'dashed' } : undefined, { overflow: 'hidden' }]}
              className={`flex-row items-center bg-white rounded-xl mb-2 px-4 py-3 border shadow-sm ${
                isSelected ? 'border-blue-500 bg-blue-50'
                : isSwapTarget ? 'border-blue-300'
                : isViolating ? 'border-yellow-300 bg-yellow-50'
                : 'border-gray-100'
              }`}
            >
              {player && <GenderCorner gender={player.gender} size={12} />}
              <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                isSelected ? 'bg-blue-500' : isViolating ? 'bg-yellow-200' : 'bg-gray-100'
              }`}>
                <Text className={`font-bold text-sm ${
                  isSelected ? 'text-white' : isViolating ? 'text-yellow-800' : 'text-gray-500'
                }`}>
                  {index + 1}
                </Text>
              </View>

              {player ? (
                <View className="flex-1 flex-row items-center justify-between">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <Text className={`font-semibold text-base ${
                      isSelected ? 'text-blue-700' : isViolating ? 'text-yellow-900' : 'text-gray-900'
                    }`} numberOfLines={1}>
                      {player.name}
                    </Text>
                    {isSub && (
                      <View style={{ backgroundColor: '#F3E8FF', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#7C3AED' }}>SUB</Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-row items-center gap-2">
                    {isViolating && !isSelected && (
                      <Ionicons name={'warning' as any} size={14} color="#CA8A04" />
                    )}
                    {!isSelected && (
                      <TouchableOpacity onPress={() => handleClearSlot(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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

      {/* Player / sub picker */}
      <Modal visible={pickerOpen} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View className="flex-1 justify-end">
            <TouchableOpacity className="flex-1" onPress={() => { setPickerOpen(false); setAddingSubMode(false); }} />
            <View className="bg-white rounded-t-2xl" style={{ maxHeight: 480 }}>

              {/* Header */}
              <View className="px-4 py-4 border-b border-gray-100 flex-row items-center justify-between">
                {addingSubMode ? (
                  <TouchableOpacity onPress={() => setAddingSubMode(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name={'chevron-back' as any} size={18} color="#2563EB" />
                    <Text style={{ color: '#2563EB', fontWeight: '600' }}>Back</Text>
                  </TouchableOpacity>
                ) : (
                  <Text className="font-bold text-gray-900 text-base">
                    Batting #{(pickerTargetIndex ?? 0) + 1}
                  </Text>
                )}
                <TouchableOpacity onPress={() => { setPickerOpen(false); setAddingSubMode(false); }}>
                  <Text className="text-blue-600 font-medium">Cancel</Text>
                </TouchableOpacity>
              </View>

              {addingSubMode ? (
                /* ── Add sub form ── */
                <View style={{ padding: 20, gap: 16 }}>
                  <TextInput
                    value={subName}
                    onChangeText={setSubName}
                    placeholder="Substitute's name"
                    placeholderTextColor="#9CA3AF"
                    autoFocus
                    style={{
                      borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
                      paddingHorizontal: 14, paddingVertical: 12,
                      fontSize: 16, color: '#111827', backgroundColor: '#F9FAFB',
                    }}
                    returnKeyType="done"
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['M', 'F'] as const).map((g) => (
                      <TouchableOpacity
                        key={g}
                        onPress={() => setSubGender(g)}
                        style={{
                          flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                          borderWidth: 1.5,
                          borderColor: subGender === g ? (g === 'F' ? '#EC4899' : '#2563EB') : '#E5E7EB',
                          backgroundColor: subGender === g ? (g === 'F' ? '#FDF2F8' : '#EFF6FF') : 'white',
                        }}
                      >
                        <Text style={{
                          fontWeight: '700', fontSize: 14,
                          color: subGender === g ? (g === 'F' ? '#BE185D' : '#1D4ED8') : '#9CA3AF',
                        }}>
                          {g === 'F' ? 'Woman' : 'Man'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    onPress={handleAddSub}
                    disabled={savingSub || !subName.trim()}
                    style={{
                      backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 13,
                      alignItems: 'center', opacity: subName.trim() ? 1 : 0.4,
                    }}
                  >
                    {savingSub
                      ? <ActivityIndicator color="white" />
                      : <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Add Substitute</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                /* ── Player list ── */
                <FlatList
                  data={[...availablePlayers, ...availableSubs]}
                  keyExtractor={(p) => p.id}
                  renderItem={({ item }) => {
                    const isSub = subs.some((s) => s.id === item.id);
                    return (
                      <TouchableOpacity
                        onPress={() => handlePickPlayer(item)}
                        className="flex-row items-center px-4 py-3 border-b border-gray-50"
                        style={{ gap: 10 }}
                      >
                        <View style={{
                          width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                          backgroundColor: item.gender === 'F' ? '#EC4899' : '#3B82F6',
                        }} />
                        <Text className="flex-1 font-medium text-gray-900 text-base">{item.name}</Text>
                        {isSub && (
                          <View style={{ backgroundColor: '#F3E8FF', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#7C3AED' }}>SUB</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  ListFooterComponent={
                    <TouchableOpacity
                      onPress={() => setAddingSubMode(true)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        paddingHorizontal: 16, paddingVertical: 14,
                        borderTopWidth: availablePlayers.length + availableSubs.length > 0 ? 1 : 0,
                        borderTopColor: '#F3F4F6',
                      }}
                    >
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={'person-add-outline' as any} size={15} color="#7C3AED" />
                      </View>
                      <Text style={{ fontSize: 15, color: '#7C3AED', fontWeight: '600' }}>Add a substitute…</Text>
                    </TouchableOpacity>
                  }
                  ListEmptyComponent={null}
                />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
