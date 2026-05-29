import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, Image,
  useWindowDimensions,
} from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTeamStore } from '../../stores/teamStore';
import { supabase } from '../../lib/supabase';
import { PosPrefs } from '../../components/AddPlayerForm';
import { Sport, Team, Player } from '../../types/database';

const BRAND = '#2563EB';
const INACTIVE = '#9CA3AF';

const TAB_CONFIG = [
  { name: 'index',    label: 'Team',     icon: 'people-outline',        activeIcon: 'people'         },
  { name: 'schedule', label: 'Schedule', icon: 'calendar-outline',      activeIcon: 'calendar'       },
  { name: 'lineups',  label: 'Lineups',  icon: 'clipboard-outline',     activeIcon: 'clipboard'      },
  { name: 'profile',  label: 'Profile',  icon: 'person-circle-outline', activeIcon: 'person-circle'  },
] as const;

const AVATAR_COLORS = ['#3B82F6','#8B5CF6','#EC4899','#F97316','#14B8A6','#6366F1','#EF4444','#0EA5E9','#10B981','#F59E0B'];
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

// ─── Position Preferences Grid ───────────────────────────────────────────────

const PREF_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

function PosPrefsGrid({ posPrefs, onToggle }: { posPrefs: PosPrefs; onToggle: (pos: string) => void }) {
  return (
    <>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
        Position Preferences <Text style={{ fontWeight: '400', color: '#9CA3AF' }}>(optional)</Text>
      </Text>
      <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>
        Tap once for preferred · again for avoid · again to clear
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
        {PREF_POSITIONS.map((pos) => {
          const pref = posPrefs[pos];
          return (
            <TouchableOpacity
              key={pos}
              onPress={() => onToggle(pos)}
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
    </>
  );
}

// ─── Team Switcher Sheet ──────────────────────────────────────────────────────

function TeamSwitcherSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { team, teams, switchTeam, createTeam, fetchTeam, fetchTeamByOwner } = useTeamStore();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  type SheetMode = 'list' | 'fork' | 'create' | 'add-self' | 'join-code' | 'join-claim';
  const [mode, setMode] = useState<SheetMode>('list');
  const [newName, setNewName] = useState('');
  const [newSport, setNewSport] = useState<Sport>('softball');
  const [creating, setCreating] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinFoundTeam, setJoinFoundTeam] = useState<Team | null>(null);
  const [joinUnclaimed, setJoinUnclaimed] = useState<Player[]>([]);
  const [showJoinNewPlayer, setShowJoinNewPlayer] = useState(false);
  const [selfProfile, setSelfProfile] = useState<{ display_name: string; gender: 'M' | 'F' } | null>(null);
  const [selfPosPrefs, setSelfPosPrefs] = useState<PosPrefs>({});

  useEffect(() => {
    if (visible) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        (supabase.from('profiles') as any)
          .select('display_name, gender').eq('id', user.id).maybeSingle()
          .then(({ data }: any) => { if (data) setSelfProfile(data); });
      });
    } else {
      setMode('list'); setNewName(''); setNewSport('softball');
      setInviteInput(''); setJoinError(null); setJoinFoundTeam(null);
      setJoinUnclaimed([]); setShowJoinNewPlayer(false);
      setSelfProfile(null); setSelfPosPrefs({});
    }
  }, [visible]);

  function toggleSelfPref(pos: string) {
    setSelfPosPrefs((prev) => {
      const cur = prev[pos] ?? null;
      const next: 'preferred' | 'avoid' | null = !cur ? 'preferred' : cur === 'preferred' ? 'avoid' : null;
      if (pos === 'CF') return { ...prev, LC: next, CF: next, RC: next };
      return { ...prev, [pos]: next };
    });
  }

  async function handleSelect(teamId: string) {
    if (teamId !== team?.id) await switchTeam(teamId);
    onClose();
  }

  function handleCreate() {
    if (!newName.trim()) return;
    setMode('add-self');
  }

  async function handleCreateWithSelf() {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const name = selfProfile?.display_name ?? '';
      const gender = selfProfile?.gender ?? 'M';
      await createTeam(newName.trim(), newSport);
      const newTeam = useTeamStore.getState().team;
      if (!newTeam) throw new Error('Team creation failed');
      const { data: player } = await (supabase.from('players') as any)
        .insert({ team_id: newTeam.id, name, gender, is_active: true, user_id: user.id })
        .select('id').single();
      const prefRows = Object.entries(selfPosPrefs)
        .filter(([, pref]) => pref)
        .map(([position, preference]) => ({ player_id: (player as any).id, position, preference: preference! }));
      if (prefRows.length > 0) await (supabase.from('position_preferences') as any).insert(prefRows);
      await fetchTeam(newTeam.id);
      onClose();
      router.navigate('/(tabs)');
    } catch {
      Alert.alert('Error', 'Could not create team. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleLookupCode() {
    const code = inviteInput.trim().toUpperCase();
    if (code.length !== 4) return;
    setJoinLoading(true); setJoinError(null);
    try {
      const { data: teamData, error } = await (supabase.from('teams') as any)
        .select('*').eq('invite_code', code).single();
      if (error || !teamData) { setJoinError('No team found with that code.'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (uid) {
        const { data: existing } = await (supabase.from('players') as any)
          .select('id').eq('team_id', teamData.id).eq('user_id', uid)
          .eq('is_active', true).maybeSingle();
        if (existing) { setJoinError("You're already on that team."); return; }
      }
      const { data: players } = await (supabase.from('players') as any)
        .select('*').eq('team_id', teamData.id).eq('is_active', true)
        .eq('is_ghost', false).is('user_id', null).order('name');
      const unclaimed = players ?? [];
      setJoinFoundTeam(teamData);
      setJoinUnclaimed(unclaimed);
      if (unclaimed.length === 0) setShowJoinNewPlayer(true);
      setMode('join-claim');
    } catch {
      setJoinError('No team found with that code.');
    } finally {
      setJoinLoading(false);
    }
  }

  async function handleClaim(playerId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setJoinLoading(true);
    try {
      await (supabase.from('players') as any).update({ user_id: user.id }).eq('id', playerId);
      await fetchTeamByOwner();
      if (joinFoundTeam) await switchTeam(joinFoundTeam.id);
      onClose();
      router.navigate('/(tabs)');
    } finally {
      setJoinLoading(false);
    }
  }

  async function handleJoinAsNew() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !joinFoundTeam) return;
    setJoinLoading(true);
    try {
      const name = selfProfile?.display_name ?? '';
      const gender = selfProfile?.gender ?? 'M';
      const { data: player } = await (supabase.from('players') as any)
        .insert({ team_id: joinFoundTeam.id, name, gender, is_active: true, user_id: user.id })
        .select('id').single();
      const prefRows = Object.entries(selfPosPrefs)
        .filter(([, pref]) => pref)
        .map(([position, preference]) => ({ player_id: (player as any).id, position, preference: preference! }));
      if (prefRows.length > 0) await (supabase.from('position_preferences') as any).insert(prefRows);
      await fetchTeamByOwner();
      await switchTeam(joinFoundTeam.id);
      onClose();
      router.navigate('/(tabs)');
    } finally {
      setJoinLoading(false);
    }
  }

  function SheetHeader({ title, onBack }: { title: string; onBack: () => void }) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={'chevron-back' as any} size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center', marginRight: 24 }}>
          {title}
        </Text>
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ backgroundColor: '#F3F4F6', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 }} />

            {/* List */}
            {mode === 'list' && (
              <View style={{ paddingHorizontal: 20, paddingBottom: 36 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 }}>Your Teams</Text>
                <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                  {teams.map((t) => {
                    const isActive = t.id === team?.id;
                    return (
                      <TouchableOpacity key={t.id} onPress={() => handleSelect(t.id)} activeOpacity={0.7}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, backgroundColor: isActive ? '#DBEAFE' : 'white', borderRadius: 14, marginBottom: 8 }}
                      >
                        {t.photo_url ? (
                          <Image source={{ uri: t.photo_url }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 12 }} />
                        ) : (
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: 'white' }}>{getInitials(t.name)}</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 16, fontWeight: '600', color: isActive ? '#1D4ED8' : '#111827' }}>{t.name}</Text>
                          <Text style={{ fontSize: 12, color: isActive ? '#3B82F6' : '#9CA3AF', textTransform: 'capitalize', marginTop: 1 }}>{t.sport}</Text>
                        </View>
                        {isActive && <Ionicons name={'checkmark-circle' as any} size={22} color={BRAND} />}
                      </TouchableOpacity>
                    );
                  })}
                  {teams.length === 0 && <Text style={{ color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 }}>No teams found</Text>}
                </ScrollView>
                <TouchableOpacity onPress={() => setMode('fork')}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14, marginTop: 4, marginBottom: 12, borderWidth: 1.5, borderColor: '#BFDBFE', backgroundColor: 'white' }}
                >
                  <Ionicons name={'add-circle-outline' as any} size={20} color={BRAND} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: BRAND }}>New Team</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={{ paddingVertical: 14, alignItems: 'center', backgroundColor: BRAND, borderRadius: 12 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: 'white' }}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Fork */}
            {mode === 'fork' && (
              <View style={{ paddingHorizontal: 20, paddingBottom: 36 }}>
                <SheetHeader title="Add Team" onBack={() => setMode('list')} />
                <TouchableOpacity onPress={() => setMode('create')} style={{ backgroundColor: BRAND, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Create a Team</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode('join-code')} style={{ borderWidth: 1.5, borderColor: BRAND, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: BRAND, fontWeight: '700', fontSize: 16 }}>Join a Team</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Create */}
            {mode === 'create' && (
              <View style={{ paddingHorizontal: 20, paddingBottom: 36 }}>
                <SheetHeader title="New Team" onBack={() => setMode('fork')} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Team Name</Text>
                <TextInput value={newName} onChangeText={setNewName} placeholder="e.g. The Mighty Ducks" placeholderTextColor="#9CA3AF" autoFocus autoCapitalize="words" returnKeyType="done"
                  style={{ backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', marginBottom: 20 }}
                />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10 }}>Sport</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
                  {(['softball', 'kickball'] as Sport[]).map((sport) => {
                    const active = newSport === sport;
                    return (
                      <TouchableOpacity key={sport} onPress={() => setNewSport(sport)} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: active ? BRAND : 'white', borderWidth: 1.5, borderColor: active ? BRAND : '#E5E7EB' }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: active ? 'white' : '#6B7280', textTransform: 'capitalize' }}>{sport}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity onPress={handleCreate} disabled={!newName.trim()} style={{ backgroundColor: BRAND, borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: !newName.trim() ? 0.4 : 1 }}>
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Continue</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Add self to new team */}
            {mode === 'add-self' && (
              <View style={{ paddingHorizontal: 20, paddingBottom: 36, maxHeight: windowHeight * 0.82 }}>
                <SheetHeader title="Add Yourself" onBack={() => setMode('create')} />
                {selfProfile && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: 'white' }}>{getInitials(selfProfile.display_name)}</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: '#1D4ED8' }}>
                      Adding <Text style={{ fontWeight: '700' }}>{selfProfile.display_name}</Text> to {newName}
                    </Text>
                  </View>
                )}
                <ScrollView showsVerticalScrollIndicator={false}>
                  <PosPrefsGrid posPrefs={selfPosPrefs} onToggle={toggleSelfPref} />
                  <TouchableOpacity
                    onPress={handleCreateWithSelf}
                    disabled={creating}
                    style={{ backgroundColor: BRAND, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 }}
                  >
                    {creating ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Create Team</Text>}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}

            {/* Join: enter code */}
            {mode === 'join-code' && (
              <View style={{ paddingHorizontal: 20, paddingBottom: 36 }}>
                <SheetHeader title="Join a Team" onBack={() => { setMode('fork'); setInviteInput(''); setJoinError(null); }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Invite Code</Text>
                <TextInput
                  value={inviteInput}
                  onChangeText={(t) => { setInviteInput(t.toUpperCase().slice(0, 4)); setJoinError(null); }}
                  placeholder="e.g. B7KP" placeholderTextColor="#9CA3AF"
                  autoFocus autoCapitalize="characters" autoCorrect={false}
                  returnKeyType="done" onSubmitEditing={handleLookupCode}
                  style={{ backgroundColor: 'white', borderWidth: 1.5, borderColor: joinError ? '#EF4444' : '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 22, fontWeight: '700', letterSpacing: 6, color: '#111827', marginBottom: joinError ? 8 : 20, textAlign: 'center' }}
                />
                {joinError && <Text style={{ fontSize: 13, color: '#EF4444', marginBottom: 16 }}>{joinError}</Text>}
                <TouchableOpacity onPress={handleLookupCode} disabled={joinLoading || inviteInput.length !== 4} style={{ backgroundColor: BRAND, borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: inviteInput.length !== 4 ? 0.4 : 1 }}>
                  {joinLoading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Continue</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Join: claim player */}
            {mode === 'join-claim' && !showJoinNewPlayer && (
              <View style={{ paddingHorizontal: 20, paddingBottom: 36 }}>
                <SheetHeader title={joinFoundTeam?.name ?? 'Claim Your Spot'} onBack={() => setMode('join-code')} />
                <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>
                  Select yourself from the roster, or add yourself if you're not listed.
                </Text>
                <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                  {joinUnclaimed.length === 0 && <Text style={{ color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 }}>No unclaimed players yet.</Text>}
                  {joinUnclaimed.map((p) => (
                    <TouchableOpacity key={p.id} onPress={() => handleClaim(p.id)} disabled={joinLoading}
                      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' }}
                    >
                      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: getAvatarColor(p.name), alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: 'white' }}>{getInitials(p.name)}</Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' }}>{p.name}</Text>
                      <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{p.gender === 'M' ? 'Man' : 'Woman'}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity onPress={() => setShowJoinNewPlayer(true)} style={{ marginTop: 8, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: 'white' }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>I'm not listed — add me</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Join: new player form */}
            {mode === 'join-claim' && showJoinNewPlayer && (
              <View style={{ paddingHorizontal: 20, paddingBottom: 36, maxHeight: windowHeight * 0.82 }}>
                <SheetHeader title="Add Yourself" onBack={() => setShowJoinNewPlayer(false)} />
                {selfProfile && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: 'white' }}>{getInitials(selfProfile.display_name)}</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: '#1D4ED8' }}>
                      Joining as <Text style={{ fontWeight: '700' }}>{selfProfile.display_name}</Text>
                    </Text>
                  </View>
                )}
                <ScrollView showsVerticalScrollIndicator={false}>
                  <PosPrefsGrid posPrefs={selfPosPrefs} onToggle={toggleSelfPref} />
                  <TouchableOpacity
                    onPress={handleJoinAsNew}
                    disabled={joinLoading}
                    style={{ backgroundColor: BRAND, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 }}
                  >
                    {joinLoading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Join Team</Text>}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}

          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

type TabBarProps = {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  navigation: { emit: (e: any) => void; navigate: (name: string) => void };
};

function TabBar({ state, navigation }: TabBarProps) {
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { team } = useTeamStore();

  return (
    <>
      <View style={{
        flexDirection: 'row',
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 8,
      }}>
        <TouchableOpacity
          onPress={() => setTeamSheetOpen(true)}
          style={{ flex: 1, alignItems: 'center' }}
          activeOpacity={0.7}
        >
          <View style={{ backgroundColor: '#DBEAFE', borderRadius: 10, padding: 4 }}>
            <View style={{ position: 'relative' }}>
              {team?.photo_url ? (
                <Image source={{ uri: team.photo_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
              ) : team ? (
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: 'white' }}>{getInitials(team.name)}</Text>
                </View>
              ) : (
                <Ionicons name={'shield-outline' as any} size={36} color={BRAND} />
              )}
              {team && (
                <View style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 14, height: 14, borderRadius: 7,
                  backgroundColor: BRAND, borderWidth: 1.5, borderColor: '#DBEAFE',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={'chevron-up' as any} size={8} color="white" />
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const cfg = TAB_CONFIG.find(t => t.name === route.name);
          if (!cfg) return null;
          const color = isFocused ? BRAND : INACTIVE;
          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => {
                if (!isFocused) {
                  navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  navigation.navigate(route.name);
                }
              }}
              style={{ flex: 1, alignItems: 'center' }}
              activeOpacity={0.7}
            >
              <Ionicons name={(isFocused ? cfg.activeIcon : cfg.icon) as any} size={24} color={color} />
              <Text style={{ fontSize: 10, color, marginTop: 2 }}>{cfg.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TeamSwitcherSheet visible={teamSheetOpen} onClose={() => setTeamSheetOpen(false)} />
    </>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: '#1E40AF' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ headerShown: false }} />
      <Tabs.Screen name="schedule" options={{ headerShown: false }} />
      <Tabs.Screen name="lineups" options={{ headerShown: false }} />
      <Tabs.Screen name="profile" options={{ headerShown: false }} />
    </Tabs>
  );
}
