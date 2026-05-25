import { Stack } from 'expo-router';

export default function LineupsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1E40AF' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
      }}
    />
  );
}
