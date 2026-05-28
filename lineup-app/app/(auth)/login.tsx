import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      router.push({ pathname: '/(auth)/verify', params: { email: trimmed } });
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>

          {/* Logo */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 20,
              backgroundColor: '#1E40AF', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}>
              <Ionicons name={'shield' as any} size={36} color="white" />
            </View>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#111827' }}>
              Lineup Manager
            </Text>
            <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 6, textAlign: 'center' }}>
              Sign in to manage your team
            </Text>
          </View>

          {/* Form */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
            Email address
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={handleSendCode}
            style={{
              backgroundColor: 'white', borderWidth: 1.5, borderColor: '#E5E7EB',
              borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
              fontSize: 16, color: '#111827', marginBottom: 20,
            }}
          />

          <TouchableOpacity
            onPress={handleSendCode}
            disabled={loading}
            style={{
              backgroundColor: '#2563EB', borderRadius: 12,
              paddingVertical: 15, alignItems: 'center',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? <ActivityIndicator color="white" />
              : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Send Code</Text>}
          </TouchableOpacity>

          <Text style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 20 }}>
            We'll send a 6-digit code to your email.{'\n'}No password needed.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
