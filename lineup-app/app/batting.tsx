import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTeamStore } from '../stores/teamStore';
import { supabase } from '../lib/supabase';
import { Player } from '../types/database';

const TEAM_ID = '00000000-0000-0000-0000-000000000001';
const LINEUP_ID = '30000000-0000-0000-0000-000000000001';
const SLOT_COUNT = 10;

export default function BattingOrderScreen() {
  const { players, fetchTeam } = useTeamStore();
  const [slots, setSlots] = useState<(Player | null)[]>(Array(SLOT_COUNT).fill(null));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (players.length === 0) fetchTeam(TEAM_ID);
  }, []);

  const assignedIds = new Set(slots.filter(Boolean).map((p) => p!.id));
  const availablePlayers = players.filter((p) => !assignedIds.has(p.id));

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

  async function handleSave() {
    setSaving(true);
    try {
      await supabase.from('batting_order').delete().eq('lineup_id', LINEUP_ID);
      const rows = slots
        .map((player, i) =>
          player ? { lineup_id: LINEUP_ID, order_index: i + 1, player_id: player.id } : null
        )
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (rows.length > 0) {
        await supabase.from('batting_order').insert(rows);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Batting Order' }} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {slots.map((player, index) => {
          const isSelected = selectedIndex === index;
          const isSwapTarget = selectedIndex !== null && !isSelected;
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
                  : 'border-gray-100'
              }`}
            >
              <View
                className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                  isSelected ? 'bg-blue-500' : 'bg-gray-100'
                }`}
              >
                <Text
                  className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-gray-500'}`}
                >
                  {index + 1}
                </Text>
              </View>

              {player ? (
                <View className="flex-1 flex-row items-center justify-between">
                  <Text
                    className={`font-semibold text-base ${
                      isSelected ? 'text-blue-700' : 'text-gray-900'
                    }`}
                  >
                    {player.name}
                  </Text>
                  <View className="flex-row items-center gap-2">
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

      <View className="px-4 pb-4 pt-2 bg-white border-t border-gray-100 flex-row gap-3">
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="flex-1 border border-brand rounded-xl py-3 items-center"
        >
          {saving ? (
            <ActivityIndicator color="#2563EB" />
          ) : (
            <Text className="text-brand font-bold text-base">Save</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/positions')}
          className="flex-1 bg-brand rounded-xl py-3 items-center"
        >
          <Text className="text-white font-bold text-base">Defense →</Text>
        </TouchableOpacity>
      </View>

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
