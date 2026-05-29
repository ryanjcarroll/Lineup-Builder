import { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../lib/supabase';

const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  async function handleVerify(fullCode: string) {
    if (fullCode.length !== CODE_LENGTH) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: fullCode,
        type: 'email',
      });
      if (error) throw error;
      // Root layout's onAuthStateChange fires and redirects automatically
    } catch {
      setError('Invalid or expired code. Please try again.');
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  function handleChange(text: string) {
    setError(null);
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) handleVerify(digits);
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      Alert.alert('Code sent', 'A new code has been sent to your email.');
      setCode('');
      inputRef.current?.focus();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: 28 }}>

        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginTop: 16, alignSelf: 'flex-start', padding: 4 }}
        >
          <Ionicons name={'chevron-back' as any} size={26} color="#374151" />
        </TouchableOpacity>

        {/* Header */}
        <View style={{ marginTop: 32, marginBottom: 40 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
            Check your email
          </Text>
          <Text style={{ fontSize: 15, color: '#6B7280', lineHeight: 22 }}>
            We sent a 6-digit code to{'\n'}
            <Text style={{ fontWeight: '600', color: '#374151' }}>{email}</Text>
          </Text>
        </View>

        {/*
          Single hidden TextInput captures all keystrokes.
          Visual boxes are rendered on top — no inter-box focus hops.
        */}
        <View style={{ marginBottom: 12 }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => inputRef.current?.focus()}
            onLongPress={async () => {
              const text = await Clipboard.getStringAsync();
              const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
              if (digits) handleChange(digits);
            }}
            style={{ flexDirection: 'row', gap: 10 }}
          >
            {Array.from({ length: CODE_LENGTH }).map((_, i) => {
              const digit = code[i] ?? '';
              const isNext = code.length === i && !loading;
              return (
                <View
                  key={i}
                  style={{
                    flex: 1, aspectRatio: 1,
                    borderWidth: 2,
                    borderColor: error ? '#DC2626' : digit ? '#2563EB' : isNext ? '#93C5FD' : '#E5E7EB',
                    borderRadius: 12,
                    backgroundColor: 'white',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827' }}>
                    {digit}
                  </Text>
                </View>
              );
            })}
          </TouchableOpacity>

          {/* Invisible input positioned over the boxes */}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleChange}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoFocus
            caretHidden
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              opacity: 0,
            }}
          />
        </View>

        {/* Error */}
        {error && (
          <Text style={{ fontSize: 13, color: '#DC2626', marginBottom: 16 }}>
            {error}
          </Text>
        )}

        {/* Verify button */}
        <TouchableOpacity
          onPress={() => handleVerify(code)}
          disabled={loading || code.length !== CODE_LENGTH}
          style={{
            backgroundColor: '#2563EB', borderRadius: 12,
            paddingVertical: 15, alignItems: 'center', marginTop: 8,
            opacity: loading || code.length !== CODE_LENGTH ? 0.4 : 1,
          }}
        >
          {loading
            ? <ActivityIndicator color="white" />
            : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Verify</Text>}
        </TouchableOpacity>

        {/* Resend */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24, gap: 4 }}>
          <Text style={{ fontSize: 14, color: '#6B7280' }}>Didn't get it?</Text>
          <TouchableOpacity onPress={handleResend} disabled={resending}>
            {resending
              ? <ActivityIndicator size="small" color="#2563EB" />
              : <Text style={{ fontSize: 14, color: '#2563EB', fontWeight: '600' }}>Resend code</Text>}
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}
