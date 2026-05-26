import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import PlayerCard from '../../components/PlayerCard';
import EditRulesModal from '../../components/EditRulesModal';
import EditStrategiesModal from '../../components/EditStrategiesModal';
import AddPlayerForm, { PosPrefs } from '../../components/AddPlayerForm';
import { useTeamStore } from '../../stores/teamStore';
import { supabase } from '../../lib/supabase';

const TEAM_ID = '00000000-0000-0000-0000-000000000001';

// One-time migration: ensure any player with LC or RC also has all three (LC, CF, RC)
// with the same preference, since CF is now the canonical "center outfield" group selector.
async function migrateOutfieldPreferences() {
  const { data } = await (supabase.from('position_preferences') as any)
    .select('player_id, position, preference')
    .in('position', ['LC', 'RC', 'CF']);
  if (!data || (data as any[]).length === 0) return;

  const byPlayer = new Map<string, Partial<Record<'LC' | 'CF' | 'RC', string>>>();
  for (const row of data as any[]) {
    if (!byPlayer.has(row.player_id)) byPlayer.set(row.player_id, {});
    byPlayer.get(row.player_id)![row.position as 'LC' | 'CF' | 'RC'] = row.preference;
  }

  const upserts: any[] = [];
  for (const [playerId, prefs] of byPlayer.entries()) {
    const pref = prefs.LC ?? prefs.CF ?? prefs.RC;
    if (!pref) continue;
    for (const pos of ['LC', 'CF', 'RC'] as const) {
      if (!prefs[pos]) upserts.push({ player_id: playerId, position: pos, preference: pref });
    }
  }
  if (upserts.length > 0) {
    await (supabase.from('position_preferences') as any).upsert(upserts);
  }
}

const AVATAR_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F97316',
  '#14B8A6', '#6366F1', '#EF4444', '#0EA5E9',
  '#10B981', '#F59E0B', '#6D28D9', '#DC2626',
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

// ─── Edit Team Info ───────────────────────────────────────────────────────────

function EditTeamModal({ visible, onClose, onSaved }: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { team } = useTeamStore();
  const [name, setName] = useState(team?.name ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(team?.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(team?.name ?? '');
      setPhotoUrl(team?.photo_url ?? null);
    }
  }, [visible]);

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset.base64) return;
    setUploading(true);
    try {
      const { base64, uri } = asset;
      const mime = uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const dataUrl = `data:${mime};base64,${base64}`;
      const { error } = await (supabase.from('teams') as any)
        .update({ photo_url: dataUrl })
        .eq('id', TEAM_ID);
      if (error) throw error;
      setPhotoUrl(dataUrl);
    } catch (e) {
      const msg = (e as any)?.message ?? String(e);
      Alert.alert('Upload failed', msg);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await (supabase.from('teams') as any)
        .update({ name: name.trim() })
        .eq('id', TEAM_ID);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const previewColor = getAvatarColor(name.trim() || team?.name || '');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 }} />
            <View style={{ paddingHorizontal: 24, paddingBottom: 40 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 24 }}>
                Edit Team Info
              </Text>

              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <TouchableOpacity onPress={handlePickPhoto} disabled={uploading} style={{ position: 'relative' }}>
                  {photoUrl ? (
                    <Image
                      source={{ uri: photoUrl }}
                      style={{ width: 80, height: 80, borderRadius: 40 }}
                    />
                  ) : (
                    <View style={{
                      width: 80, height: 80, borderRadius: 40,
                      backgroundColor: previewColor,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 28, fontWeight: '700', color: 'white' }}>
                        {getInitials(name.trim() || team?.name || '?')}
                      </Text>
                    </View>
                  )}
                  <View style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 26, height: 26, borderRadius: 13,
                    backgroundColor: '#2563EB', borderWidth: 2, borderColor: 'white',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {uploading
                      ? <ActivityIndicator size="small" color="white" />
                      : <Ionicons name={'camera' as any} size={13} color="white" />}
                  </View>
                </TouchableOpacity>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>Tap to change photo</Text>
              </View>

              <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Team Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={{
                  backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
                  borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                  fontSize: 16, color: '#111827', marginBottom: 20,
                }}
                placeholder="Team name"
                placeholderTextColor="#9CA3AF"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />

              <TouchableOpacity
                onPress={handleSave}
                disabled={saving || uploading || !name.trim()}
                style={{
                  backgroundColor: '#2563EB', borderRadius: 12,
                  paddingVertical: 14, alignItems: 'center',
                  opacity: !name.trim() || uploading ? 0.4 : 1,
                }}
              >
                {saving
                  ? <ActivityIndicator color="white" />
                  : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Edit Roster ──────────────────────────────────────────────────────────────

function EditRosterModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { players, fetchTeam } = useTeamStore();
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!visible) setAddOpen(false);
  }, [visible]);

  async function handleAdd(name: string, gender: 'M' | 'F', posPrefs: PosPrefs) {
    const { data: player, error } = await supabase
      .from('players')
      .insert({ team_id: TEAM_ID, name, gender, is_active: true } as any)
      .select('id')
      .single();
    if (error || !player) return;

    const prefRows = Object.entries(posPrefs)
      .filter(([, pref]) => pref)
      .map(([position, preference]) => ({ player_id: (player as any).id, position, preference: preference! }));
    if (prefRows.length > 0) {
      await supabase.from('position_preferences').insert(prefRows as any);
    }

    await fetchTeam(TEAM_ID);
    setAddOpen(false);
  }

  function handleRemove(playerId: string, playerName: string) {
    Alert.alert(
      'Remove Player',
      `Remove ${playerName} from the roster?`,
      [
        { text: 'Keep Player', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            await (supabase.from('players') as any).update({ is_active: false }).eq('id', playerId);
            await fetchTeam(TEAM_ID);
          },
        },
      ]
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#1E40AF',
        }}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={'chevron-back' as any} size={26} color="white" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '700', color: 'white' }}>Roster</Text>
          <View style={{ width: 26 }} />
        </View>

        <>
          <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
            {players.map((player) => {
              const avatarColor = getAvatarColor(player.name);
              return (
                <View key={player.id} style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: 'white', marginHorizontal: 16, marginBottom: 8,
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
                  borderWidth: 1, borderColor: '#F3F4F6',
                }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: avatarColor, alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: 'white' }}>
                      {getInitials(player.name)}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' }}>
                    {player.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemove(player.id, player.name)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name={'trash-outline' as any} size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
          <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
            <TouchableOpacity
              onPress={() => setAddOpen(true)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14,
              }}
            >
              <Ionicons name={'person-add-outline' as any} size={20} color="white" />
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Add Player</Text>
            </TouchableOpacity>
            </View>
          </>

        {/* Add Player bottom sheet */}
        <Modal visible={addOpen} transparent animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAddOpen(false)} />
              <View style={{ backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' }}>
                <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center', paddingVertical: 12 }}>Add Player</Text>
                <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  <AddPlayerForm onSubmit={handleAdd} submitLabel="Add to Roster" />
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

const ACTIONS = [
  { icon: 'create-outline',        label: 'Team Info'   },
  { icon: 'people-outline',        label: 'Roster'      },
  { icon: 'document-text-outline', label: 'Rules'       },
  { icon: 'map-outline',           label: 'Strategies'  },
] as const;

export default function RosterScreen() {
  const { team, players, loading, error, fetchTeam } = useTeamStore();
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [editRosterOpen, setEditRosterOpen] = useState(false);
  const [editRulesOpen, setEditRulesOpen] = useState(false);
  const [editStrategiesOpen, setEditStrategiesOpen] = useState(false);

  useEffect(() => {
    fetchTeam(TEAM_ID);
    migrateOutfieldPreferences().then(() => fetchTeam(TEAM_ID));
  }, []);

  const maleCount   = players.filter((p) => p.gender === 'M').length;
  const femaleCount = players.filter((p) => p.gender === 'F').length;
  const avatarColor = team ? getAvatarColor(team.name) : '#3B82F6';

  function handleAction(label: string) {
    if (label === 'Team Info') setEditTeamOpen(true);
    else if (label === 'Roster') setEditRosterOpen(true);
    else if (label === 'Rules') setEditRulesOpen(true);
    else if (label === 'Strategies') setEditStrategiesOpen(true);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>

      {/* ── Team profile header ─────────────────────────────────────────── */}
      <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        {loading || !team ? (
          <ActivityIndicator size="large" color="#2563EB" style={{ marginVertical: 24 }} />
        ) : (
          <>
            {team.photo_url ? (
              <Image
                source={{ uri: team.photo_url }}
                style={{ width: 88, height: 88, borderRadius: 44, marginBottom: 12 }}
              />
            ) : (
              <View style={{
                width: 88, height: 88, borderRadius: 44,
                backgroundColor: avatarColor,
                alignItems: 'center', justifyContent: 'center', marginBottom: 12,
              }}>
                <Text style={{ fontSize: 32, fontWeight: '700', color: 'white' }}>
                  {getInitials(team.name)}
                </Text>
              </View>
            )}
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 }}>
              {team?.name}
            </Text>
            <Text style={{ fontSize: 13, color: '#6B7280' }}>
              {players.length} Players  |  {maleCount}M  {femaleCount}W
            </Text>
          </>
        )}
      </View>

      {/* ── Action icons ────────────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 14 }}>
        {ACTIONS.map(({ icon, label }) => (
          <TouchableOpacity
            key={label}
            onPress={() => handleAction(label)}
            style={{ flex: 1, alignItems: 'center', gap: 6 }}
            activeOpacity={0.7}
          >
            <View style={{
              width: 42, height: 42, borderRadius: 21,
              backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name={icon as any} size={20} color="#2563EB" />
            </View>
            <Text style={{ fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' }}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Player list ─────────────────────────────────────────────────── */}
      {error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: '#DC2626', fontWeight: '500' }}>Failed to load roster</Text>
          <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4 }}>{error}</Text>
          <TouchableOpacity
            onPress={() => fetchTeam(TEAM_ID)}
            style={{ marginTop: 16, backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {players.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </ScrollView>
      )}

      <EditTeamModal
        visible={editTeamOpen}
        onClose={() => setEditTeamOpen(false)}
        onSaved={() => fetchTeam(TEAM_ID)}
      />
      <EditRosterModal
        visible={editRosterOpen}
        onClose={() => setEditRosterOpen(false)}
      />
      <EditRulesModal
        visible={editRulesOpen}
        onClose={() => setEditRulesOpen(false)}
      />
      <EditStrategiesModal
        visible={editStrategiesOpen}
        onClose={() => setEditStrategiesOpen(false)}
      />
    </SafeAreaView>
  );
}
