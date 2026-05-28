import '../global.css';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Stack, router } from 'expo-router';
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
    if (session) router.replace('/(tabs)');
    else router.replace('/(auth)/login');
  }, [session]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
