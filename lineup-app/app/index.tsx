import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import PlayerCard, { Player } from '../components/PlayerCard';

const PLAYERS: Player[] = [
  {
    id: '1',
    name: 'Ryan Carroll',
    gender: 'M',
    number: 7,
    preferences: { SS: 'preferred', '2B': 'preferred', '3B': 'willing', P: 'never' },
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    gender: 'F',
    number: 12,
    preferences: { '2B': 'preferred', CF: 'preferred', SS: 'willing', C: 'never' },
  },
  {
    id: '3',
    name: 'Mike Chen',
    gender: 'M',
    number: 4,
    preferences: { P: 'preferred', '1B': 'willing', RF: 'willing' },
  },
  {
    id: '4',
    name: 'Jess Martinez',
    gender: 'F',
    number: 22,
    preferences: { LF: 'preferred', CF: 'preferred', RF: 'preferred', P: 'never' },
  },
  {
    id: '5',
    name: 'Tom Nguyen',
    gender: 'M',
    number: 15,
    preferences: { '3B': 'preferred', SS: 'willing', '2B': 'willing' },
  },
  {
    id: '6',
    name: 'Dana Lee',
    gender: 'F',
    number: 9,
    preferences: { C: 'preferred', '1B': 'willing', '3B': 'never' },
  },
  {
    id: '7',
    name: 'Chris Park',
    gender: 'M',
    number: 33,
    preferences: { '1B': 'preferred', P: 'willing', RF: 'willing', C: 'never' },
  },
  {
    id: '8',
    name: 'Amy Torres',
    gender: 'F',
    number: 6,
    preferences: { SS: 'preferred', '2B': 'preferred' },
  },
  {
    id: '9',
    name: 'Jordan Blake',
    gender: 'M',
    number: 18,
    preferences: { CF: 'preferred', LF: 'willing', RF: 'willing', C: 'never' },
  },
  {
    id: '10',
    name: 'Mia Russo',
    gender: 'F',
    number: 3,
    preferences: { '2B': 'preferred', SS: 'willing', P: 'never' },
  },
  {
    id: '11',
    name: 'Derek Hill',
    gender: 'M',
    number: 24,
    preferences: { RF: 'preferred', LF: 'willing', '1B': 'willing' },
  },
  {
    id: '12',
    name: 'Priya Shah',
    gender: 'F',
    number: 11,
    preferences: { '3B': 'preferred', SS: 'willing', C: 'never' },
  },
];

const maleCount = PLAYERS.filter((p) => p.gender === 'M').length;
const femaleCount = PLAYERS.filter((p) => p.gender === 'F').length;

export default function RosterScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Thunder Cats — Roster' }} />

      {/* Summary bar */}
      <View className="bg-white border-b border-gray-200 px-4 py-3 flex-row items-center justify-between">
        <Text className="text-gray-600 text-sm">
          <Text className="font-semibold text-gray-900">{PLAYERS.length} players</Text>
          {'  ·  '}
          <Text className="text-blue-700 font-medium">{maleCount}M</Text>
          {'  '}
          <Text className="text-pink-600 font-medium">{femaleCount}W</Text>
        </Text>
        <TouchableOpacity className="bg-brand px-3 py-1.5 rounded-lg">
          <Text className="text-white text-sm font-semibold">+ Add Player</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {PLAYERS.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
