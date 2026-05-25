import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PlayerCard from '../../components/PlayerCard';
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

function EditRosterModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { players } = useTeamStore();
  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#1E40AF',
        }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: 'white' }}>Roster</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {players.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </ScrollView>
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

  useEffect(() => { fetchTeam(TEAM_ID); }, []);

  const maleCount   = players.filter((p) => p.gender === 'M').length;
  const femaleCount = players.filter((p) => p.gender === 'F').length;
  const avatarColor = team ? getAvatarColor(team.name) : '#3B82F6';

  function handleAction(label: string) {
    if (label === 'Edit Team Info') setEditTeamOpen(true);
    else if (label === 'Edit Roster') setEditRosterOpen(true);
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
    </SafeAreaView>
  );
}
