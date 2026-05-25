import { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import PlayerCard from '../components/PlayerCard';
import { useTeamStore } from '../stores/teamStore';

const TEAM_ID = '00000000-0000-0000-0000-000000000001';

export default function RosterScreen() {
  const { team, players, loading, error, fetchTeam } = useTeamStore();

  useEffect(() => {
    fetchTeam(TEAM_ID);
  }, []);

  const maleCount = players.filter((p) => p.gender === 'M').length;
  const femaleCount = players.filter((p) => p.gender === 'F').length;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <Stack.Screen options={{ title: team ? `${team.name} — Roster` : 'Roster' }} />

      <View className="bg-white border-b border-gray-200 px-4 py-3 flex-row items-center justify-between">
        <Text className="text-gray-600 text-sm">
          {loading ? (
            'Loading...'
          ) : (
            <>
              <Text className="font-semibold text-gray-900">{players.length} players</Text>
              {'  ·  '}
              <Text className="text-blue-700 font-medium">{maleCount}M</Text>
              {'  '}
              <Text className="text-pink-600 font-medium">{femaleCount}W</Text>
            </>
          )}
        </Text>
        <View className="flex-row gap-2">
          <TouchableOpacity className="bg-brand px-3 py-1.5 rounded-lg">
            <Text className="text-white text-sm font-semibold">+ Add Player</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/batting')}
            className="bg-gray-800 px-3 py-1.5 rounded-lg"
          >
            <Text className="text-white text-sm font-semibold">Lineup →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-red-600 text-center font-medium">Failed to load roster</Text>
          <Text className="text-gray-400 text-sm text-center mt-1">{error}</Text>
          <TouchableOpacity onPress={() => fetchTeam(TEAM_ID)} className="mt-4 bg-brand px-4 py-2 rounded-lg">
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {players.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
