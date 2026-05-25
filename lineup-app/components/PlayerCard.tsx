import { View, Text } from 'react-native';
import { Player } from '../types/database';

interface Props {
  player: Player;
}

export default function PlayerCard({ player }: Props) {
  const prefs = player.position_preferences ?? [];
  const preferred = prefs.filter((p) => p.preference === 'preferred').map((p) => p.position);
  const avoid = prefs.filter((p) => p.preference === 'avoid').map((p) => p.position);

  return (
    <View className="bg-white rounded-xl mx-4 mb-3 p-4 shadow-sm border border-gray-100">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-gray-900 font-semibold text-base">{player.name}</Text>
        <View className={`px-2 py-0.5 rounded-full ${player.gender === 'F' ? 'bg-pink-100' : 'bg-blue-100'}`}>
          <Text className={`text-xs font-semibold ${player.gender === 'F' ? 'text-pink-700' : 'text-blue-700'}`}>
            {player.gender === 'F' ? 'W' : 'M'}
          </Text>
        </View>
      </View>

      {preferred.length > 0 && (
        <View className="flex-row flex-wrap gap-1 mt-1">
          <Text className="text-xs text-gray-400 self-center mr-1">Prefers:</Text>
          {preferred.map((pos) => (
            <View key={pos} className="bg-green-100 px-2 py-0.5 rounded-full">
              <Text className="text-green-800 text-xs font-medium">{pos}</Text>
            </View>
          ))}
        </View>
      )}

      {avoid.length > 0 && (
        <View className="flex-row flex-wrap gap-1 mt-1">
          <Text className="text-xs text-gray-400 self-center mr-1">Avoid:</Text>
          {avoid.map((pos) => (
            <View key={pos} className="bg-red-100 px-2 py-0.5 rounded-full">
              <Text className="text-red-700 text-xs font-medium">{pos}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
