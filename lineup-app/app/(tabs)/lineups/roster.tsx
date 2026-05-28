import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Switch, ScrollView, Modal,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AddPlayerForm, { PosPrefs } from '../../../components/AddPlayerForm';
import GenderCorner from '../../../components/GenderCorner';
import { useTeamStore } from '../../../stores/teamStore';
import { useGameStore } from '../../../stores/gameStore';
import { supabase } from '../../../lib/supabase';
import { Player, playerName, playerGender } from '../../../types/database';
import { DEFAULT_RULES } from '../../../components/EditRulesModal';


const AVATAR_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#14B8A6', '#6366F1',
  '#EF4444', '#0EA5E9', '#10B981', '#F59E0B', '#6D28D9', '#DC2626',
  '#0891B2', '#D97706', '#7C3AED', '#059669',
];

function getAvatarColor(name: string): string {
  const hash = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function GameRosterScreen() {
  const { players, team } = useTeamStore();
  const { selectedGame, setRosterLocked } = useGameStore();
  const navigation = useNavigation();

  const [attending, setAttending] = useState<Set<string>>(new Set());
  const [subs, setSubs] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addSubOpen, setAddSubOpen] = useState(false);

  const savedAttendingJson = useRef('');
  const hasUnsavedChanges = useRef(false);
  hasUnsavedChanges.current =
    JSON.stringify([...attending].sort()) !== savedAttendingJson.current;

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: any) => {
      if (!hasUnsavedChanges.current) return;
      e.preventDefault();
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes to the game roster. Leave without saving?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]
      );
    });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    if (selectedGame && players.length > 0) loadRoster();
  }, [selectedGame?.id, players]);

  async function loadRoster() {
    if (!selectedGame) return;
    setLoading(true);
    try {
      const { data: rosterRows } = await (supabase.from('game_roster') as any)
        .select('player_id, is_guest')
        .eq('game_id', selectedGame.id);

      const hasExistingRoster = rosterRows?.some((r: any) => !r.is_guest) ?? false;

      let attendingIds: Set<string>;
      if (!hasExistingRoster) {
        attendingIds = new Set(players.map((p) => p.id));
      } else {
        attendingIds = new Set(
          rosterRows!.filter((r: any) => !r.is_guest).map((r: any) => r.player_id)
        );
      }

      const subIds = rosterRows?.filter((r: any) => r.is_guest).map((r: any) => r.player_id) ?? [];
      let subPlayers: Player[] = [];
      if (subIds.length > 0) {
        const { data } = await supabase
          .from('players')
          .select('*, position_preferences(*)')
          .in('id', subIds);
        subPlayers = (data as Player[]) ?? [];
      }

      setAttending(attendingIds);
      setSubs(subPlayers);
      savedAttendingJson.current = JSON.stringify([...attendingIds].sort());
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!selectedGame) return;
    setSaving(true);
    try {
      await supabase
        .from('game_roster')
        .delete()
        .eq('game_id', selectedGame.id)
        .eq('is_guest', false);

      const rows = [...attending].map((playerId) => ({
        game_id: selectedGame.id,
        player_id: playerId,
        is_guest: false,
      }));
      if (rows.length > 0) {
        await (supabase.from('game_roster') as any).insert(rows);
      }

      savedAttendingJson.current = JSON.stringify([...attending].sort());
      hasUnsavedChanges.current = false;
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  function toggleAttending(playerId: string) {
    setAttending((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  async function handleAddSub(name: string, gender: 'M' | 'F', posPrefs: PosPrefs) {
    if (!selectedGame) return;
    const { data: player, error } = await (supabase.from('players') as any)
      .insert({ team_id: team!.id, name, gender, is_active: false })
      .select('id')
      .single();
    if (error || !player) return;

    const prefRows = Object.entries(posPrefs)
      .filter(([, pref]) => pref)
      .map(([position, preference]) => ({ player_id: player.id, position, preference: preference! }));
    if (prefRows.length > 0) {
      await (supabase.from('position_preferences') as any).insert(prefRows);
    }

    await (supabase.from('game_roster') as any).insert({
      game_id: selectedGame.id,
      player_id: player.id,
      is_guest: true,
    });

    const { data: fullPlayer } = await supabase
      .from('players')
      .select('*, position_preferences(*)')
      .eq('id', player.id)
      .single();

    if (fullPlayer) setSubs((prev) => [...prev, fullPlayer as Player]);
    setAddSubOpen(false);
  }

  function handleRemoveSub(sub: Player) {
    if (!selectedGame) return;
    Alert.alert(
      'Remove Sub',
      `Remove ${playerName(sub).split(' ')[0]} from this game?`,
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('game_roster')
              .delete()
              .eq('game_id', selectedGame.id)
              .eq('player_id', sub.id);
            setSubs((prev) => prev.filter((s) => s.id !== sub.id));
          },
        },
      ]
    );
  }

  const isLocked = selectedGame?.roster_locked ?? false;

  const maxField = team?.rules?.players_in_field ?? DEFAULT_RULES.players_in_field;
  const maxMenField = team?.rules?.max_male_in_field ?? DEFAULT_RULES.max_male_in_field;
  const allAttending = [...players.filter((p) => attending.has(p.id)), ...subs];
  const womenAttending = allAttending.filter((p) => playerGender(p) === 'F').length;
  const fieldersAllowed = Math.min(maxField, womenAttending + maxMenField, allAttending.length);
  const fieldersReduced = fieldersAllowed < maxField;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={[]}>
      <Stack.Screen
        options={{
          title: 'Game Roster',
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Save</Text>}
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

            {/* Lock/Unlock Roster section */}
            <Text style={{
              fontSize: 11, fontWeight: '700', color: '#9CA3AF',
              textTransform: 'uppercase', letterSpacing: 0.8,
              paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
            }}>
              Lock / Unlock Roster
            </Text>
            {selectedGame && (
              <View style={{
                marginHorizontal: 16, marginBottom: 16,
                backgroundColor: 'white', borderRadius: 12,
                borderWidth: 1, borderColor: '#F3F4F6',
                paddingHorizontal: 16, paddingVertical: 14,
                flexDirection: 'row', alignItems: 'center', gap: 14,
              }}>
                <TouchableOpacity
                  onPress={() => setRosterLocked(selectedGame.id, !isLocked)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    backgroundColor: isLocked ? '#F0FDF4' : '#EFF6FF',
                    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: isLocked ? '#86EFAC' : '#BFDBFE',
                  }}
                >
                  <Ionicons
                    name={isLocked ? ('lock-closed' as any) : ('lock-open-outline' as any)}
                    size={18}
                    color={isLocked ? '#16A34A' : '#2563EB'}
                  />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: isLocked ? '#16A34A' : '#2563EB' }}>
                    {isLocked ? 'Unlock Roster' : 'Lock Roster'}
                  </Text>
                </TouchableOpacity>
                <Text style={{ flex: 1, fontSize: 12, color: '#9CA3AF', lineHeight: 17 }}>
                  {isLocked
                    ? 'Roster is locked. Unlock to make changes.'
                    : 'Lock when RSVPs are final to enable lineups.'}
                </Text>
              </View>
            )}

            {/* Team players */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 6 }}>
              <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Team RSVP
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#9CA3AF' }}>Attending?</Text>
            </View>

            {/* Attendance summary */}
            <Text style={{
              fontSize: 12, fontWeight: '600', color: '#6B7280',
              paddingHorizontal: 16, paddingBottom: 4,
            }}>
              {(() => {
                const men = allAttending.filter((p) => playerGender(p) === 'M').length;
                const women = allAttending.filter((p) => playerGender(p) === 'F').length;
                const total = allAttending.length;
                return `${total} player${total !== 1 ? 's' : ''} attending (${men} men, ${women} women)`;
              })()}
            </Text>
            <Text style={{
              fontSize: 12, fontWeight: '600',
              color: fieldersReduced ? '#DC2626' : '#6B7280',
              paddingHorizontal: 16, paddingBottom: 10,
            }}>
              {fieldersAllowed} fielders allowed{fieldersReduced ? ' (reduced)' : ''}
            </Text>

            <View style={{ opacity: isLocked ? 0.4 : 1 }} pointerEvents={isLocked ? 'none' : 'auto'}>
              {players.map((player) => (
                <TouchableOpacity
                  key={player.id}
                  onPress={() => toggleAttending(player.id)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: 'white',
                    marginHorizontal: 16, marginBottom: 6,
                    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
                    borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden',
                  }}
                >
                  <GenderCorner gender={playerGender(player)} />
                  <View style={{
                    width: 34, height: 34, borderRadius: 17,
                    backgroundColor: getAvatarColor(playerName(player)),
                    alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: 'white' }}>
                      {getInitials(playerName(player))}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' }}>
                    {playerName(player)}
                  </Text>
                  <Switch
                    value={attending.has(player.id)}
                    onValueChange={() => toggleAttending(player.id)}
                    trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
                    thumbColor={attending.has(player.id) ? '#2563EB' : '#D1D5DB'}
                  />
                </TouchableOpacity>
              ))}

              {/* Subs section */}
              <Text style={{
                fontSize: 11, fontWeight: '700', color: '#9CA3AF',
                textTransform: 'uppercase', letterSpacing: 0.8,
                paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8,
              }}>
                Substitutes
              </Text>

              {subs.length === 0 ? (
                <Text style={{ fontSize: 13, color: '#9CA3AF', paddingHorizontal: 16, paddingBottom: 8 }}>
                  No subs for this game
                </Text>
              ) : (
                subs.map((sub) => (
                  <View key={sub.id} style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: 'white',
                    marginHorizontal: 16, marginBottom: 6,
                    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
                    borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden',
                  }}>
                    <GenderCorner gender={playerGender(sub)} />
                    <View style={{
                      width: 34, height: 34, borderRadius: 17,
                      backgroundColor: getAvatarColor(playerName(sub)),
                      alignItems: 'center', justifyContent: 'center', marginRight: 12,
                    }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: 'white' }}>
                        {getInitials(playerName(sub))}
                      </Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' }}>
                      {playerName(sub)}
                    </Text>
                    <View style={{
                      backgroundColor: '#EDE9FE', borderRadius: 6,
                      paddingHorizontal: 6, paddingVertical: 2, marginRight: 10,
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#7C3AED' }}>SUB</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveSub(sub)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name={'trash-outline' as any} size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              {/* Add Sub */}
              <TouchableOpacity
                onPress={() => setAddSubOpen(true)}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginHorizontal: 16, marginTop: 10, paddingVertical: 12,
                  borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB',
                  borderStyle: 'dashed', backgroundColor: 'white',
                }}
              >
                <Ionicons name={'person-add-outline' as any} size={18} color="#6B7280" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}>Add Sub</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
      )}

      {/* Add Sub bottom sheet */}
      <Modal visible={addSubOpen} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAddSubOpen(false)} />
            <View style={{ backgroundColor: '#F3F4F6', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' }}>
              <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center', paddingVertical: 12 }}>Add Sub</Text>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <AddPlayerForm onSubmit={handleAddSub} namePlaceholder="Sub's name" submitLabel="Add Sub" />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
