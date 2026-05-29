import '../global.css';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '../lib/supabase';
import { useTeamStore } from '../stores/teamStore';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_OUT') useTeamStore.getState().resetStore();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) { router.replace('/(auth)/login'); return; }

    (supabase.from('profiles') as any)
      .select('display_name')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }: any) => {
        if (!error && data?.display_name) router.replace('/(tabs)');
        else if (!error) router.replace('/onboarding');
        else router.replace('/(tabs)'); // fail open on network error
      });
  }, [session]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
