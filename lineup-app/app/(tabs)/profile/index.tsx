import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { User } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Back', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await supabase.auth.signOut();
          // _layout.tsx onAuthStateChange redirects automatically
        },
      },
    ]);
  }

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : '?';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6' }} edges={[]}>
      <Stack.Screen options={{ title: 'Profile' }} />
      <View style={{ flex: 1, paddingHorizontal: 20 }}>

        {/* Avatar + identity */}
        <View style={{ alignItems: 'center', paddingTop: 36, paddingBottom: 36 }}>
          <View style={{
            width: 84, height: 84, borderRadius: 42,
            backgroundColor: '#1E40AF',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
          }}>
            <Text style={{ fontSize: 30, fontWeight: '800', color: 'white' }}>{initials}</Text>
          </View>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 6 }}>
            {user?.email ?? ''}
          </Text>
        </View>

        {/* Account info card */}
        <View style={{ backgroundColor: 'white', borderRadius: 16, marginBottom: 16, overflow: 'hidden' }}>
          <View style={{
            paddingHorizontal: 16, paddingVertical: 14,
            flexDirection: 'row', alignItems: 'center',
            borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
          }}>
            <Ionicons name={'mail-outline' as any} size={20} color="#6B7280" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 2 }}>Email</Text>
              <Text style={{ fontSize: 15, color: '#111827' }}>{user?.email ?? 'â€”'}</Text>
            </View>
          </View>
          <View style={{
            paddingHorizontal: 16, paddingVertical: 14,
            flexDirection: 'row', alignItems: 'center',
          }}>
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
    </SafeAreaView>
  );
}

