import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PlayerCard from '../../components/PlayerCard';
import EditRulesModal from '../../components/EditRulesModal';
import { useTeamStore } from '../../stores/teamStore';
import { supabase } from '../../lib/supabase';

const TEAM_ID = '00000000-0000-0000-0000-000000000001';

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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setName(team?.name ?? '');
  }, [visible]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await supabase.from('teams').update({ name: name.trim() }).eq('id', TEAM_ID);
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
                <View style={{
                  width: 80, height: 80, borderRadius: 40,
                  backgroundColor: previewColor,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 28, fontWeight: '700', color: 'white' }}>
                    {getInitials(name.trim() || team?.name || '?')}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>Photo upload coming soon</Text>
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
                disabled={saving || !name.trim()}
                style={{
                  backgroundColor: '#2563EB', borderRadius: 12,
                  paddingVertical: 14, alignItems: 'center',
                  opacity: !name.trim() ? 0.4 : 1,
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

const FIELD_POSITIONS_ALL = ['LF', 'LC', 'RC', 'RF', 'SS', '2B', '3B', '1B', 'P', 'C'];

function EditRosterModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { players, fetchTeam } = useTeamStore();
  const [view, setView] = useState<'list' | 'add'>('list');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [posPrefs, setPosPrefs] = useState<Record<string, 'preferred' | 'avoid' | null>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) { setView('list'); resetForm(); }
  }, [visible]);

  function resetForm() {
    setName('');
    setGender('M');
    setPosPrefs({});
  }

  function togglePref(pos: string) {
    setPosPrefs(prev => {
      const cur = prev[pos];
      return { ...prev, [pos]: !cur ? 'preferred' : cur === 'preferred' ? 'avoid' : null };
    });
  }

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { data: player, error } = await supabase
        .from('players')
        .insert({ team_id: TEAM_ID, name: name.trim(), gender, is_active: true } as any)
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
      resetForm();
      setView('list');
    } finally {
      setSaving(false);
    }
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
          {view === 'add' ? (
            <TouchableOpacity onPress={() => { setView('list'); resetForm(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={'chevron-back' as any} size={24} color="white" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}
          <Text style={{ fontSize: 18, fontWeight: '700', color: 'white' }}>
            {view === 'add' ? 'Add Player' : 'Roster'}
          </Text>
          {view === 'list' ? (
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {view === 'list' ? (
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
                onPress={() => setView('add')}
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
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Player name"
                placeholderTextColor="#9CA3AF"
                autoFocus
                style={{
                  backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB',
                  borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                  fontSize: 16, color: '#111827', marginBottom: 20,
                }}
                returnKeyType="done"
              />

              <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Gender</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                {(['M', 'F'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setGender(g)}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                      backgroundColor: gender === g ? (g === 'M' ? '#DBEAFE' : '#FCE7F3') : 'white',
                      borderWidth: 1.5,
                      borderColor: gender === g ? (g === 'M' ? '#3B82F6' : '#EC4899') : '#E5E7EB',
                    }}
                  >
                    <Text style={{
                      fontWeight: '700', fontSize: 15,
                      color: gender === g ? (g === 'M' ? '#1D4ED8' : '#BE185D') : '#9CA3AF',
                    }}>
                      {g === 'M' ? 'Man' : 'Woman'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
                Position Preferences{' '}
                <Text style={{ fontWeight: '400', color: '#9CA3AF' }}>(optional)</Text>
              </Text>
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>
                Tap once for preferred · again for avoid · again to clear
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
                {FIELD_POSITIONS_ALL.map((pos) => {
                  const pref = posPrefs[pos];
                  return (
                    <TouchableOpacity
                      key={pos}
                      onPress={() => togglePref(pos)}
                      style={{
                        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                        backgroundColor: pref === 'preferred' ? '#DCFCE7' : pref === 'avoid' ? '#FEE2E2' : 'white',
                        borderWidth: 1.5,
                        borderColor: pref === 'preferred' ? '#16A34A' : pref === 'avoid' ? '#EF4444' : '#E5E7EB',
                      }}
                    >
                      <Text style={{
                        fontSize: 14, fontWeight: '600',
                        color: pref === 'preferred' ? '#15803D' : pref === 'avoid' ? '#DC2626' : '#9CA3AF',
                      }}>
                        {pos}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                onPress={handleAdd}
                disabled={saving || !name.trim()}
                style={{
                  backgroundColor: '#2563EB', borderRadius: 12,
                  paddingVertical: 14, alignItems: 'center',
                  opacity: !name.trim() ? 0.4 : 1,
                }}
              >
                {saving
                  ? <ActivityIndicator color="white" />
                  : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Add to Roster</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

const ACTIONS = [
  { icon: 'create-outline',       label: 'Edit Team Info' },
  { icon: 'people-outline',       label: 'Edit Roster'    },
  { icon: 'document-text-outline', label: 'Edit Rules'    },
] as const;

export default function RosterScreen() {
  const { team, players, loading, error, fetchTeam } = useTeamStore();
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [editRosterOpen, setEditRosterOpen] = useState(false);
  const [editRulesOpen, setEditRulesOpen] = useState(false);

  useEffect(() => { fetchTeam(TEAM_ID); }, []);

  const maleCount   = players.filter((p) => p.gender === 'M').length;
  const femaleCount = players.filter((p) => p.gender === 'F').length;
  const avatarColor = team ? getAvatarColor(team.name) : '#3B82F6';

  function handleAction(label: string) {
    if (label === 'Edit Team Info') setEditTeamOpen(true);
    else if (label === 'Edit Roster') setEditRosterOpen(true);
    else if (label === 'Edit Rules') setEditRulesOpen(true);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>

      {/* ── Team profile header ─────────────────────────────────────────── */}
      <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        {loading || !team ? (
          <ActivityIndicator size="large" color="#2563EB" style={{ marginVertical: 24 }} />
        ) : (
          <>
            <View style={{
              width: 88, height: 88, borderRadius: 44,
              backgroundColor: avatarColor,
              alignItems: 'center', justifyContent: 'center', marginBottom: 12,
            }}>
              <Text style={{ fontSize: 32, fontWeight: '700', color: 'white' }}>
                {getInitials(team?.name ?? '')}
              </Text>
            </View>
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
    </SafeAreaView>
  );
}
