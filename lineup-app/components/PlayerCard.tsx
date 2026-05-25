import { View, Text } from 'react-native';

const PREFERENCE_COLORS = {
  preferred: 'bg-green-100 text-green-800',
  willing: 'bg-gray-100 text-gray-600',
  never: 'bg-red-100 text-red-700',
} as const;

type Preference = keyof typeof PREFERENCE_COLORS;

export interface Player {
  id: string;
  name: string;
  gender: 'M' | 'F';
  number?: number;
  preferences: Partial<Record<string, Preference>>;
}

interface Props {
  player: Player;
}

export default function PlayerCard({ player }: Props) {
  const preferredPositions = Object.entries(player.preferences)
    .filter(([, pref]) => pref === 'preferred')
    .map(([pos]) => pos);

  const neverPositions = Object.entries(player.preferences)
    .filter(([, pref]) => pref === 'never')
    .map(([pos]) => pos);

  return (
    <View className="bg-white rounded-xl mx-4 mb-3 p-4 shadow-sm border border-gray-100">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2">
          {player.number !== undefined && (
            <View className="w-8 h-8 rounded-full bg-brand-light items-center justify-center">
              <Text className="text-brand font-bold text-sm">#{player.number}</Text>
            </View>
          )}
          <Text className="text-gray-900 font-semibold text-base">{player.name}</Text>
        </View>
        <View
          className={`px-2 py-0.5 rounded-full ${
            player.gender === 'F' ? 'bg-pink-100' : 'bg-blue-100'
          }`}
        >
          <Text
            className={`text-xs font-semibold ${
              player.gender === 'F' ? 'text-pink-700' : 'text-blue-700'
            }`}
          >
            {player.gender === 'F' ? 'W' : 'M'}
          </Text>
        </View>
      </View>

      {preferredPositions.length > 0 && (
        <View className="flex-row flex-wrap gap-1 mt-1">
          <Text className="text-xs text-gray-400 self-center mr-1">Prefers:</Text>
          {preferredPositions.map((pos) => (
            <View key={pos} className="bg-green-100 px-2 py-0.5 rounded-full">
              <Text className="text-green-800 text-xs font-medium">{pos}</Text>
            </View>
          ))}
        </View>
      )}

      {neverPositions.length > 0 && (
        <View className="flex-row flex-wrap gap-1 mt-1">
          <Text className="text-xs text-gray-400 self-center mr-1">Never:</Text>
          {neverPositions.map((pos) => (
            <View key={pos} className="bg-red-100 px-2 py-0.5 rounded-full">
              <Text className="text-red-700 text-xs font-medium">{pos}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
