import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Image, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import PlayerCard from '../../components/PlayerCard';
import EditRulesModal from '../../components/EditRulesModal';
import EditStrategiesModal from '../../components/EditStrategiesModal';
import AddPlayerForm, { PosPrefs } from '../../components/AddPlayerForm';
import { useTeamStore } from '../../stores/teamStore';
import { supabase } from '../../lib/supabase';
import { Sport, Team, Player } from '../../types/database';
import { useFocusEffect } from 'expo-router';

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

function EditTeamModal({ visible, onClose, onSaved, isCaptain }: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  isCaptain: boolean;
}) {
  const { team, players, deleteTeam, fetchTeamByOwner } = useTeamStore();
  const [name, setName] = useState(team?.name ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(team?.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  async function handleCopyCode() {
    if (!team?.invite_code) return;
    await Clipboard.setStringAsync(team.invite_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  function handleDelete() {
    Alert.alert(
      'Delete Team',
      `Permanently delete "${team?.name}" and all its players, games, and lineups? This cannot be undone.`,
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            onClose();
            await deleteTeam(team!.id);
          },
        },
      ]
    );
  }

  function handleLeave() {
    Alert.alert(
      'Leave Team',
      `Leave "${team?.name}"? You'll be removed from the roster.`,
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Leave', style: 'destructive', onPress: async () => {
            onClose();
            const { data: { session } } = await supabase.auth.getSession();
            const uid = session?.user?.id;
            if (!uid) return;
            const myPlayer = players.find((p) => p.user_id === uid);
            if (myPlayer) {
              await (supabase.from('players') as any).update({ is_active: false }).eq('id', myPlayer.id);
            }
            await fetchTeamByOwner();
          },
        },
      ]
    );
  }

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
        .eq('id', team!.id);
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
        .eq('id', team!.id);
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
          <View style={{ backgroundColor: '#F3F4F6', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
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

              {team?.invite_code && (
                <>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Invite Code</Text>
                  <TouchableOpacity
                    onPress={handleCopyCode}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
                      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                      marginBottom: 20,
                    }}
                  >
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', letterSpacing: 3, color: codeCopied ? '#16A34A' : '#374151' }}>
                      {team.invite_code}
                    </Text>
                    <Ionicons name={(codeCopied ? 'checkmark-circle' : 'copy-outline') as any} size={18} color={codeCopied ? '#16A34A' : '#6B7280'} />
                  </TouchableOpacity>
                </>
              )}

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

              <View style={{ marginTop: 28, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 16 }}>
                <TouchableOpacity onPress={isCaptain ? handleDelete : handleLeave} style={{ alignItems: 'center', paddingVertical: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#DC2626' }}>
                    {isCaptain ? 'Delete Team' : 'Leave Team'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


// ─── Popup Menu ───────────────────────────────────────────────────────────────

interface PopupMenuItem { label: string; onPress: () => void }

function PopupMenu({ items, anchorRef, visible, onClose, preferAbove = false }: {
  items: PopupMenuItem[];
  anchorRef: React.RefObject<any>;
  visible: boolean;
  onClose: () => void;
  preferAbove?: boolean;
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      anchorRef.current?.measure((_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
        const screenHeight = Dimensions.get('window').height;
        const estimatedMenuHeight = items.length * 46;
        // pageY is from the top of the full screen; Modal coordinate space starts
        // below the status bar/notch, so subtract the top inset to align correctly.
        const adjustedY = pageY - insets.top;
        const showAbove = preferAbove || adjustedY + height + estimatedMenuHeight > screenHeight - 80;
        setPos({
          top: showAbove ? adjustedY - estimatedMenuHeight - 4 : adjustedY + height + 4,
          right: Dimensions.get('window').width - pageX - width,
        });
      });
    } else {
      setPos(null);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          activeOpacity={1}
          onPress={onClose}
        />
        {pos && (
          <View style={{
            position: 'absolute', ...pos,
            backgroundColor: 'white', borderRadius: 8, minWidth: 168,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
            overflow: 'hidden',
          }}>
            {items.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => { onClose(); item.onPress(); }}
                style={{
                  paddingHorizontal: 16, paddingVertical: 13,
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderTopColor: '#F3F4F6',
                }}
              >
                <Text style={{ fontSize: 15, color: '#111827' }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Edit Position Preferences Modal ─────────────────────────────────────────

const POSITION_PREFS_ALL = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

function EditPositionPrefsModal({ visible, onClose, onSave, initialPrefs }: {
  visible: boolean;
  onClose: () => void;
  onSave: (posPrefs: PosPrefs) => Promise<void>;
  initialPrefs: PosPrefs;
}) {
  const [posPrefs, setPosPrefs] = useState<PosPrefs>(initialPrefs);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setPosPrefs(initialPrefs);
  }, [visible]);

  function togglePref(pos: string) {
    setPosPrefs((prev) => {
      const cur = prev[pos] ?? null;
      const next: 'preferred' | 'avoid' | null = !cur ? 'preferred' : cur === 'preferred' ? 'avoid' : null;
      if (pos === 'CF') return { ...prev, LC: next, CF: next, RC: next };
      return { ...prev, [pos]: next };
    });
  }

  async function handleSave() {
    setSaving(true);
    try { await onSave(posPrefs); } finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ alignSelf: 'flex-start', marginBottom: 20 }}
          >
            <Ionicons name={'chevron-back' as any} size={26} color="#374151" />
          </TouchableOpacity>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
            Position Preferences
          </Text>
          <Text style={{ fontSize: 15, color: '#6B7280', lineHeight: 22 }}>
            Tap once for preferred · again for avoid · again to clear
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, marginBottom: 32 }}>
            {POSITION_PREFS_ALL.map((pos) => {
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
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
          >
            {saving
              ? <ActivityIndicator color="white" />
              : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Save Preferences</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

const ACTIONS = [
  { icon: 'document-text-outline', label: 'Rules'       },
  { icon: 'map-outline',           label: 'Strategies'  },
  { icon: 'create-outline',        label: 'Team Info'   },
] as const;

export default function RosterScreen() {
  const { team, players, loading, error, fetchTeam, fetchTeamByOwner, createTeam, ensureInviteCode } = useTeamStore();
  const kebabRef = useRef<any>(null);
  const fabRef = useRef<any>(null);
  const [kebabMenuOpen, setKebabMenuOpen] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [editRulesOpen, setEditRulesOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [editStrategiesOpen, setEditStrategiesOpen] = useState(false);

  // Create team form state
  const [createName, setCreateName] = useState('');
  const [createSport, setCreateSport] = useState<Sport>('softball');
  const [creating, setCreating] = useState(false);
  const [showAddSelf, setShowAddSelf] = useState(false);
  const [editSelfOpen, setEditSelfOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // Join flow
  type OnboardingView = 'fork' | 'create' | 'join-code' | 'join-claim';
  const [onboardingView, setOnboardingView] = useState<OnboardingView>('fork');
  const [inviteInput, setInviteInput] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinFoundTeam, setJoinFoundTeam] = useState<Team | null>(null);
  const [joinUnclaimed, setJoinUnclaimed] = useState<Player[]>([]);
  const [showJoinNewPlayer, setShowJoinNewPlayer] = useState(false);

  useEffect(() => {
    fetchTeamByOwner();
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null));
    migrateOutfieldPreferences().then(() => {
      // Re-fetch after migration only if a team exists
      useTeamStore.getState().team?.id &&
        fetchTeam(useTeamStore.getState().team!.id);
    });
  }, []);

  useEffect(() => {
    if (team && !team.invite_code) ensureInviteCode(team.id);
  }, [team?.id, team?.invite_code]);

  // Reset selection mode when the active team changes (team switcher)
  useEffect(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, [team?.id]);

  // Reset selection mode when the user navigates away from this tab
  useFocusEffect(
    useCallback(() => {
      return () => {
        setSelectionMode(false);
        setSelectedIds(new Set());
      };
    }, [])
  );

  async function handleCopyCode() {
    if (!team?.invite_code) return;
    await Clipboard.setStringAsync(team.invite_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  const maleCount   = players.filter((p) => p.gender === 'M').length;
  const femaleCount = players.filter((p) => p.gender === 'F').length;
  const avatarColor = team ? getAvatarColor(team.name) : '#3B82F6';

  function handleAction(label: string) {
    if (label === 'Rules') setEditRulesOpen(true);
    else if (label === 'Strategies') setEditStrategiesOpen(true);
    else if (label === 'Team Info') setEditTeamOpen(true);
  }

  async function handleCreateTeam() {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await createTeam(createName.trim(), createSport);
      setShowAddSelf(true);
    } catch {
      Alert.alert('Error', 'Could not create team. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleAddSelf(name: string, gender: 'M' | 'F', posPrefs: PosPrefs) {
    const { data: player, error } = await supabase
      .from('players')
      .insert({ team_id: team!.id, name, gender, is_active: true, user_id: currentUserId } as any)
      .select('id')
      .single();
    if (error || !player) throw error ?? new Error('Failed to add player');

    const prefRows = Object.entries(posPrefs)
      .filter(([, pref]) => pref)
      .map(([position, preference]) => ({ player_id: (player as any).id, position, preference: preference! }));
    if (prefRows.length > 0) {
      await supabase.from('position_preferences').insert(prefRows as any);
    }

    await fetchTeam(team!.id);
    setShowAddSelf(false);
  }

  const myPlayer = currentUserId ? players.find((p) => p.user_id === currentUserId) ?? null : null;

  async function handleEditSelf(posPrefs: PosPrefs) {
    if (!myPlayer) return;
    await (supabase.from('position_preferences') as any).delete().eq('player_id', myPlayer.id);
    const prefRows = Object.entries(posPrefs)
      .filter(([, pref]) => pref)
      .map(([position, preference]) => ({ player_id: myPlayer.id, position, preference: preference! }));
    if (prefRows.length > 0) {
      await (supabase.from('position_preferences') as any).insert(prefRows);
    }
    await fetchTeam(team!.id);
    setEditSelfOpen(false);
  }

  async function handleAddPlayer(name: string, gender: 'M' | 'F', posPrefs: PosPrefs) {
    const { data: player, error } = await supabase
      .from('players')
      .insert({ team_id: team!.id, name, gender, is_active: true } as any)
      .select('id')
      .single();
    if (error || !player) return;

    const prefRows = Object.entries(posPrefs)
      .filter(([, pref]) => pref)
      .map(([position, preference]) => ({ player_id: (player as any).id, position, preference: preference! }));
    if (prefRows.length > 0) {
      await supabase.from('position_preferences').insert(prefRows as any);
    }

    await fetchTeam(team!.id);
    setAddPlayerOpen(false);
  }

  function handleDeleteSelected() {
    const ids = Array.from(selectedIds);
    Alert.alert(
      'Remove Players',
      `Remove ${ids.length} player${ids.length > 1 ? 's' : ''} from the roster?`,
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            await (supabase.from('players') as any)
              .update({ is_active: false })
              .in('id', ids);
            setSelectionMode(false);
            setSelectedIds(new Set());
            await fetchTeam(team!.id);
          },
        },
      ]
    );
  }

  async function handleLookupCode() {
    const code = inviteInput.trim().toUpperCase();
    if (code.length !== 4) return;
    setJoinLoading(true);
    setJoinError(null);
    try {
      const { data: teamData, error } = await (supabase.from('teams') as any)
        .select('*').eq('invite_code', code).single();
      if (error || !teamData) { setJoinError('No team found with that code.'); return; }

      if (currentUserId) {
        const { data: existing } = await (supabase.from('players') as any)
          .select('id').eq('team_id', teamData.id).eq('user_id', currentUserId)
          .eq('is_active', true).maybeSingle();
        if (existing) { setJoinError("You're already on that team."); return; }
      }

      const { data: players } = await (supabase.from('players') as any)
        .select('*')
        .eq('team_id', teamData.id)
        .eq('is_active', true)
        .eq('is_ghost', false)
        .is('user_id', null)
        .order('name');

      const unclaimed = players ?? [];
      setJoinFoundTeam(teamData);
      setJoinUnclaimed(unclaimed);
      if (unclaimed.length === 0) setShowJoinNewPlayer(true);
      setOnboardingView('join-claim');
    } catch {
      setJoinError('No team found with that code.');
    } finally {
      setJoinLoading(false);
    }
  }

  async function handleClaim(playerId: string) {
    const uid = currentUserId ?? (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    setJoinLoading(true);
    try {
      await (supabase.from('players') as any).update({ user_id: uid }).eq('id', playerId);
      await fetchTeamByOwner();
    } finally {
      setJoinLoading(false);
    }
  }

  async function handleJoinAsNew(name: string, gender: 'M' | 'F', posPrefs: PosPrefs) {
    const uid = currentUserId ?? (await supabase.auth.getUser()).data.user?.id;
    if (!uid || !joinFoundTeam) return;

    const { data: player } = await (supabase.from('players') as any)
      .insert({ team_id: joinFoundTeam.id, name, gender, is_active: true, user_id: uid })
      .select('id').single();

    const prefRows = Object.entries(posPrefs)
      .filter(([, pref]) => pref)
      .map(([position, preference]) => ({ player_id: (player as any).id, position, preference: preference! }));
    if (prefRows.length > 0) {
      await (supabase.from('position_preferences') as any).insert(prefRows);
    }
    await fetchTeamByOwner();
  }

  // ── Loading splash ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Add self after team creation ───────────────────────────────────────────
  if (showAddSelf) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 28, paddingVertical: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              onPress={() => setShowAddSelf(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ alignSelf: 'flex-start', marginBottom: 24 }}
            >
              <Ionicons name={'chevron-back' as any} size={26} color="#374151" />
            </TouchableOpacity>
            <View style={{ marginBottom: 32 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
                One more step
              </Text>
              <Text style={{ fontSize: 15, color: '#6B7280', lineHeight: 22 }}>
                Add yourself to the roster so you can be assigned to positions and batting order.
              </Text>
            </View>
            <AddPlayerForm
              onSubmit={handleAddSelf}
              namePlaceholder="Your name"
              submitLabel="Join My Team"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Onboarding (no team yet) ───────────────────────────────────────────────
  if (!team) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: onboardingView === 'join-claim' ? 'flex-start' : 'center', paddingHorizontal: 28, paddingVertical: 40 }}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Fork ──────────────────────────────────────────────────── */}
            {onboardingView === 'fork' && (
              <>
                <View style={{ alignItems: 'center', marginBottom: 40 }}>
                  <View style={{ width: 80, height: 80, borderRadius: 22, backgroundColor: '#1E40AF', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                    <Ionicons name={'shield' as any} size={40} color="white" />
                  </View>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
                    Welcome to Lineup Builder
                  </Text>
                  <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 }}>
                    Create a new team or join one{'\n'}with an invite code.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setOnboardingView('create')}
                  style={{ backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 12 }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Create a Team</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setOnboardingView('join-code')}
                  style={{ borderWidth: 1.5, borderColor: '#2563EB', borderRadius: 12, paddingVertical: 15, alignItems: 'center' }}
                >
                  <Text style={{ color: '#2563EB', fontWeight: '700', fontSize: 16 }}>Join a Team</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Create ────────────────────────────────────────────────── */}
            {onboardingView === 'create' && (
              <>
                <TouchableOpacity onPress={() => setOnboardingView('fork')} style={{ alignSelf: 'flex-start', marginBottom: 24 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={'chevron-back' as any} size={26} color="#374151" />
                </TouchableOpacity>
                <View style={{ alignItems: 'center', marginBottom: 32 }}>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 }}>Create your team</Text>
                  <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 }}>
                    You can customize rules and add{'\n'}players after setup.
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Team Name</Text>
                <TextInput
                  value={createName}
                  onChangeText={setCreateName}
                  placeholder="e.g. The Mighty Ducks"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  returnKeyType="done"
                  style={{ backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', marginBottom: 24 }}
                />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10 }}>Sport</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 32 }}>
                  {(['softball', 'kickball'] as Sport[]).map((sport) => {
                    const active = createSport === sport;
                    return (
                      <TouchableOpacity key={sport} onPress={() => setCreateSport(sport)} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: active ? '#2563EB' : 'white', borderWidth: 1.5, borderColor: active ? '#2563EB' : '#E5E7EB' }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: active ? 'white' : '#6B7280', textTransform: 'capitalize' }}>{sport}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity onPress={handleCreateTeam} disabled={creating || !createName.trim()} style={{ backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 15, alignItems: 'center', opacity: creating || !createName.trim() ? 0.4 : 1 }}>
                  {creating ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Create Team</Text>}
                </TouchableOpacity>
              </>
            )}

            {/* ── Join: enter code ──────────────────────────────────────── */}
            {onboardingView === 'join-code' && (
              <>
                <TouchableOpacity onPress={() => { setOnboardingView('fork'); setInviteInput(''); setJoinError(null); }} style={{ alignSelf: 'flex-start', marginBottom: 24 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={'chevron-back' as any} size={26} color="#374151" />
                </TouchableOpacity>
                <View style={{ marginBottom: 32 }}>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 }}>Join a Team</Text>
                  <Text style={{ fontSize: 15, color: '#6B7280', lineHeight: 22 }}>
                    Enter the 4-character invite code from your team captain.
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Invite Code</Text>
                <TextInput
                  value={inviteInput}
                  onChangeText={(t) => { setInviteInput(t.toUpperCase().slice(0, 4)); setJoinError(null); }}
                  placeholder="e.g. B7KP"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleLookupCode}
                  style={{ backgroundColor: 'white', borderWidth: 1.5, borderColor: joinError ? '#EF4444' : '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 22, fontWeight: '700', letterSpacing: 6, color: '#111827', marginBottom: joinError ? 8 : 28, textAlign: 'center' }}
                />
                {joinError && <Text style={{ fontSize: 13, color: '#EF4444', marginBottom: 20 }}>{joinError}</Text>}
                <TouchableOpacity onPress={handleLookupCode} disabled={joinLoading || inviteInput.length !== 4} style={{ backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 15, alignItems: 'center', opacity: inviteInput.length !== 4 ? 0.4 : 1 }}>
                  {joinLoading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Continue</Text>}
                </TouchableOpacity>
              </>
            )}

            {/* ── Join: claim player ────────────────────────────────────── */}
            {onboardingView === 'join-claim' && !showJoinNewPlayer && (
              <>
                <TouchableOpacity onPress={() => setOnboardingView('join-code')} style={{ alignSelf: 'flex-start', marginBottom: 24 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={'chevron-back' as any} size={26} color="#374151" />
                </TouchableOpacity>
                <View style={{ marginBottom: 28 }}>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 6 }}>Claim your spot</Text>
                  <Text style={{ fontSize: 15, color: '#6B7280', lineHeight: 22 }}>
                    Select yourself from {joinFoundTeam?.name ?? 'the roster'}.
                  </Text>
                </View>
                {joinUnclaimed.length === 0 && (
                  <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 24 }}>
                    No unclaimed players on this roster yet.
                  </Text>
                )}
                {joinUnclaimed.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => handleClaim(p.id)}
                    disabled={joinLoading}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: getAvatarColor(p.name), alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: 'white' }}>{getInitials(p.name)}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' }}>{p.name}</Text>
                    <Text style={{ fontSize: 13, color: '#9CA3AF' }}>{p.gender === 'M' ? 'Man' : 'Woman'}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => setShowJoinNewPlayer(true)} style={{ marginTop: 8, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: 'white' }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>I'm not listed — add me</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Join: new player form ─────────────────────────────────── */}
            {onboardingView === 'join-claim' && showJoinNewPlayer && (
              <>
                <TouchableOpacity onPress={() => setShowJoinNewPlayer(false)} style={{ alignSelf: 'flex-start', marginBottom: 24 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={'chevron-back' as any} size={26} color="#374151" />
                </TouchableOpacity>
                <View style={{ marginBottom: 28 }}>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 6 }}>Add yourself</Text>
                  <Text style={{ fontSize: 15, color: '#6B7280', lineHeight: 22 }}>
                    Enter your details to join {joinFoundTeam?.name ?? 'the team'}.
                  </Text>
                </View>
                <AddPlayerForm onSubmit={handleJoinAsNew} namePlaceholder="Your name" submitLabel="Join Team" resetOnSubmit={false} />
              </>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Normal team view ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>

      {/* ── Team profile header ─────────────────────────────────────────── */}
      <View style={{ backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        {/* Control row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, height: 44 }}>
          <View style={{ width: 40, alignItems: 'flex-start' }}>
            {selectionMode && (
              <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedIds(new Set()); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={'chevron-back' as any} size={26} color="#374151" />
              </TouchableOpacity>
            )}
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            {selectionMode && (
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Tap to select'}
              </Text>
            )}
          </View>
          <View style={{ width: 40, alignItems: 'flex-end' }}>
            {selectionMode ? (
              selectedIds.size > 0 && (
                <TouchableOpacity onPress={handleDeleteSelected} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={'trash' as any} size={22} color="#DC2626" />
                </TouchableOpacity>
              )
            ) : (
              <TouchableOpacity
                ref={kebabRef}
                onPress={() => setKebabMenuOpen(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={'ellipsis-vertical' as any} size={22} color="#374151" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Centered content */}
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 20 }}>
          <TouchableOpacity onPress={() => setEditTeamOpen(true)} activeOpacity={0.7} style={{ marginBottom: 12 }}>
            {team.photo_url ? (
              <Image source={{ uri: team.photo_url }} style={{ width: 88, height: 88, borderRadius: 44 }} />
            ) : (
              <View style={{
                width: 88, height: 88, borderRadius: 44,
                backgroundColor: avatarColor,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 32, fontWeight: '700', color: 'white' }}>
                  {getInitials(team.name)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEditTeamOpen(true)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827' }}>{team.name}</Text>
            <Ionicons name={'pencil' as any} size={20} color="#9CA3AF" />
          </TouchableOpacity>
          {team.invite_code && (
            <TouchableOpacity
              onPress={handleCopyCode}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                borderWidth: 1.5,
                borderColor: codeCopied ? '#16A34A' : '#BFDBFE',
                borderRadius: 8,
                paddingHorizontal: 12, paddingVertical: 5,
                marginBottom: 10,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', letterSpacing: 3, color: codeCopied ? '#16A34A' : '#2563EB' }}>
                {team.invite_code}
              </Text>
              <Ionicons name={(codeCopied ? 'checkmark-circle' : 'copy-outline') as any} size={16} color={codeCopied ? '#16A34A' : '#2563EB'} />
            </TouchableOpacity>
          )}
          <Text style={{ fontSize: 13, color: '#6B7280' }}>
            {players.length} Players  |  {maleCount}M  {femaleCount}W
          </Text>
        </View>
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
            onPress={() => fetchTeamByOwner()}
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
          {[...players]
            .sort((a, b) => {
              const aCapt = a.user_id === team.owner_id ? 0 : 1;
              const bCapt = b.user_id === team.owner_id ? 0 : 1;
              return aCapt - bCapt;
            })
            .map((player) => {
              const isSelected = selectedIds.has(player.id);
              const isCaptain = player.user_id === team.owner_id;
              const isMe = !!currentUserId && player.user_id === currentUserId;
              if (selectionMode) {
                if (isCaptain && isMe) {
                  return (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      isCaptain={isCaptain}
                      isMe={isMe}
                    />
                  );
                }
                return (
                  <TouchableOpacity
                    key={player.id}
                    activeOpacity={0.85}
                    onPress={() => setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(player.id)) next.delete(player.id);
                      else next.add(player.id);
                      return next;
                    })}
                  >
                    <PlayerCard
                      player={player}
                      isCaptain={isCaptain}
                      isMe={isMe}
                      isSelected={isSelected}
                    />
                  </TouchableOpacity>
                );
              }
              return (
                <PlayerCard
                  key={player.id}
                  player={player}
                  isCaptain={isCaptain}
                  isMe={isMe}
                  onEdit={isMe ? () => setEditSelfOpen(true) : undefined}
                />
              );
            })}
        </ScrollView>
      )}

      {/* ── Edit self modal ─────────────────────────────────────────────── */}
      <EditPositionPrefsModal
        visible={editSelfOpen}
        onClose={() => setEditSelfOpen(false)}
        onSave={handleEditSelf}
        initialPrefs={Object.fromEntries(
          (myPlayer?.position_preferences ?? []).map((p) => [p.position, p.preference])
        ) as PosPrefs}
      />

      {/* FAB */}
      {!selectionMode && (
        <TouchableOpacity
          ref={fabRef}
          onPress={() => setFabMenuOpen(true)}
          style={{
            position: 'absolute', bottom: 32, right: 20,
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: '#2563EB',
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
          }}
        >
          <Ionicons name={'add' as any} size={28} color="white" />
        </TouchableOpacity>
      )}

      {/* Add Player bottom sheet */}
      <Modal visible={addPlayerOpen} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAddPlayerOpen(false)} />
            <View style={{ backgroundColor: '#F3F4F6', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' }}>
              <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center', paddingVertical: 12 }}>Add Player</Text>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <AddPlayerForm onSubmit={handleAddPlayer} submitLabel="Add to Roster" />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <EditTeamModal
        visible={editTeamOpen}
        onClose={() => setEditTeamOpen(false)}
        onSaved={() => fetchTeam(team.id)}
        isCaptain={!!currentUserId && team.owner_id === currentUserId}
      />
      <EditRulesModal
        visible={editRulesOpen}
        onClose={() => setEditRulesOpen(false)}
      />
      <EditStrategiesModal
        visible={editStrategiesOpen}
        onClose={() => setEditStrategiesOpen(false)}
      />

      <PopupMenu
        anchorRef={kebabRef}
        visible={kebabMenuOpen}
        onClose={() => setKebabMenuOpen(false)}
        items={[{ label: 'Remove Players', onPress: () => setSelectionMode(true) }]}
      />
      <PopupMenu
        anchorRef={fabRef}
        visible={fabMenuOpen}
        onClose={() => setFabMenuOpen(false)}
        preferAbove
        items={[
          { label: 'Add Player', onPress: () => setAddPlayerOpen(true) },
          { label: 'Copy Invite Code', onPress: handleCopyCode },
        ]}
      />
    </SafeAreaView>
  );
}
