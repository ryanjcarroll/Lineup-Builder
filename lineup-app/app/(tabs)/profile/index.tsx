import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { User } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../lib/supabase';
import { Profile, Gender } from '../../../types/database';
import { useTeamStore } from '../../../stores/teamStore';

const AVATAR_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F97316',
  '#14B8A6', '#6366F1', '#EF4444', '#0EA5E9',
  '#10B981', '#F59E0B', '#6D28D9', '#DC2626',
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

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<Gender>('M');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const { fetchTeamByOwner } = useTeamStore();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (!user) { setLoading(false); return; }

      const { data } = await (supabase.from('profiles') as any)
        .select('*').eq('id', user.id).maybeSingle();
      if (data) {
        setProfile(data);
        setDisplayName(data.display_name ?? '');
        setGender(data.gender ?? 'M');
        setPhotoUrl(data.photo_url ?? null);
      }
      setLoading(false);
    }
    load();
  }, []);

  const isDirty = profile
    ? displayName !== (profile.display_name ?? '') || gender !== (profile.gender ?? 'M')
    : displayName !== '' || gender !== 'M';

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
      const mime = asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const dataUrl = `data:${mime};base64,${asset.base64}`;
      const { error } = await (supabase.from('profiles') as any)
        .update({ photo_url: dataUrl })
        .eq('id', user!.id);
      if (error) throw error;
      setPhotoUrl(dataUrl);
      setProfile((prev) => prev ? { ...prev, photo_url: dataUrl } : null);
    } catch (e) {
      Alert.alert('Upload failed', (e as any)?.message ?? 'Could not save photo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!user || !displayName.trim()) return;
    setSaving(true);
    try {
      const updates = { display_name: displayName.trim(), gender };
      const { error } = await (supabase.from('profiles') as any)
        .update(updates).eq('id', user.id);
      if (error) throw error;
      // Keep players rows in sync so gender-based queries stay accurate
      await (supabase.from('players') as any).update({ gender }).eq('user_id', user.id);
      setProfile((prev) => prev ? { ...prev, ...updates } : null);
      await fetchTeamByOwner();
    } catch (e) {
      Alert.alert('Error', (e as any)?.message ?? 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Back', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  const avatarName = displayName.trim() || user?.email || '';
  const avatarColor = avatarName ? getAvatarColor(avatarName) : '#1E40AF';
  const avatarLabel = displayName.trim()
    ? getInitials(displayName.trim())
    : (user?.email?.slice(0, 2).toUpperCase() ?? '?');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6' }} edges={[]}>
      <Stack.Screen options={{ title: 'Profile' }} />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 20 }}>

          {/* Avatar */}
          <View style={{ alignItems: 'center', paddingTop: 36, paddingBottom: 28 }}>
            <TouchableOpacity onPress={handlePickPhoto} disabled={uploading} style={{ position: 'relative', marginBottom: 12 }}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={{ width: 84, height: 84, borderRadius: 42 }} />
              ) : (
                <View style={{
                  width: 84, height: 84, borderRadius: 42,
                  backgroundColor: avatarColor,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 30, fontWeight: '800', color: 'white' }}>
                    {avatarLabel}
                  </Text>
                </View>
              )}
              <View style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 26, height: 26, borderRadius: 13,
                backgroundColor: '#2563EB', borderWidth: 2, borderColor: '#F3F4F6',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {uploading
                  ? <ActivityIndicator size="small" color="white" />
                  : <Ionicons name={'camera' as any} size={13} color="white" />}
              </View>
            </TouchableOpacity>
            {displayName.trim() ? (
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 2 }}>
                {displayName.trim()}
              </Text>
            ) : null}
            <Text style={{ fontSize: 14, color: '#6B7280' }}>{user?.email ?? ''}</Text>
          </View>

          {/* Profile info */}
          <Text style={{
            fontSize: 11, fontWeight: '700', color: '#9CA3AF',
            textTransform: 'uppercase', letterSpacing: 0.8,
            marginBottom: 8,
          }}>
            Profile
          </Text>
          <View style={{ backgroundColor: 'white', borderRadius: 16, marginBottom: 16, overflow: 'hidden' }}>
            {/* Name */}
            <View style={{
              paddingHorizontal: 16, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
            }}>
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>Display name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor="#D1D5DB"
                style={{ fontSize: 15, color: '#111827', padding: 0 }}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Gender */}
            <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 10 }}>Gender</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(['M', 'F'] as Gender[]).map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setGender(g)}
                    style={{
                      flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
                      backgroundColor: gender === g ? '#2563EB' : '#F3F4F6',
                      borderWidth: 1.5,
                      borderColor: gender === g ? '#2563EB' : '#E5E7EB',
                    }}
                  >
                    <Text style={{
                      fontSize: 14, fontWeight: '600',
                      color: gender === g ? 'white' : '#6B7280',
                    }}>
                      {g === 'M' ? 'Male' : 'Female'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Save button */}
          {isDirty && (
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !displayName.trim()}
              style={{
                backgroundColor: displayName.trim() ? '#2563EB' : '#93C5FD',
                borderRadius: 14, paddingVertical: 14,
                alignItems: 'center', marginBottom: 16,
              }}
            >
              {saving
                ? <ActivityIndicator color="white" />
                : <Text style={{ fontSize: 15, fontWeight: '700', color: 'white' }}>Save Profile</Text>}
            </TouchableOpacity>
          )}

          {/* Account info */}
          <Text style={{
            fontSize: 11, fontWeight: '700', color: '#9CA3AF',
            textTransform: 'uppercase', letterSpacing: 0.8,
            marginBottom: 8,
          }}>
            Account
          </Text>
          <View style={{ backgroundColor: 'white', borderRadius: 16, marginBottom: 16, overflow: 'hidden' }}>
            <View style={{
              paddingHorizontal: 16, paddingVertical: 14,
              flexDirection: 'row', alignItems: 'center',
              borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
            }}>
              <Ionicons name={'mail-outline' as any} size={20} color="#6B7280" style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 2 }}>Email</Text>
                <Text style={{ fontSize: 15, color: '#111827' }}>{user?.email ?? '—'}</Text>
              </View>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name={'key-outline' as any} size={20} color="#6B7280" style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 2 }}>Sign-in method</Text>
                <Text style={{ fontSize: 15, color: '#111827' }}>Email OTP</Text>
              </View>
            </View>
          </View>

          {/* Sign out */}
          <TouchableOpacity
            onPress={handleSignOut}
            disabled={signingOut}
            style={{
              backgroundColor: 'white', borderRadius: 16,
              paddingHorizontal: 16, paddingVertical: 16,
              flexDirection: 'row', alignItems: 'center',
            }}
          >
            <Ionicons name={'log-out-outline' as any} size={20} color="#DC2626" style={{ marginRight: 12 }} />
            {signingOut
              ? <ActivityIndicator color="#DC2626" />
              : <Text style={{ fontSize: 15, fontWeight: '600', color: '#DC2626' }}>Sign out</Text>}
          </TouchableOpacity>

        </View>
      )}
    </SafeAreaView>
  );
}
