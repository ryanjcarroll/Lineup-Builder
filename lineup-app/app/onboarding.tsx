import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Gender } from '../types/database';

export default function OnboardingScreen() {
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<Gender>('M');
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await (supabase.from('profiles') as any)
        .upsert({ id: user.id, display_name: displayName.trim(), gender });
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingTop: 56, marginBottom: 44 }}>
            <Text style={{ fontSize: 30, fontWeight: '800', color: '#111827', marginBottom: 10 }}>
              Welcome!
            </Text>
            <Text style={{ fontSize: 16, color: '#6B7280', lineHeight: 24 }}>
              Set up your player profile before joining your team.
            </Text>
          </View>

          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
            Your name
          </Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Full name"
            placeholderTextColor="#9CA3AF"
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            style={{
              backgroundColor: 'white', borderWidth: 1.5,
              borderColor: '#E5E7EB', borderRadius: 12,
              paddingHorizontal: 16, paddingVertical: 14,
              fontSize: 17, color: '#111827', marginBottom: 28,
            }}
          />

          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10 }}>
            Gender
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 48 }}>
            {(['M', 'F'] as Gender[]).map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => setGender(g)}
                style={{
                  flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
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

          <TouchableOpacity
            onPress={handleContinue}
            disabled={saving || !displayName.trim()}
            style={{
              backgroundColor: '#2563EB', borderRadius: 14,
              paddingVertical: 16, alignItems: 'center',
              opacity: !displayName.trim() ? 0.4 : 1,
            }}
          >
            {saving
              ? <ActivityIndicator color="white" />
              : <Text style={{ color: 'white', fontWeight: '700', fontSize: 17 }}>Get Started</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
