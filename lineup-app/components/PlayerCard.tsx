import { View, Text } from 'react-native';
import { Player } from '../types/database';
import GenderCorner from './GenderCorner';

interface Props {
  player: Player;
}

const AVATAR_COLORS = [
  { bg: '#3B82F6', text: '#FFFFFF' },
  { bg: '#8B5CF6', text: '#FFFFFF' },
  { bg: '#EC4899', text: '#FFFFFF' },
  { bg: '#F97316', text: '#FFFFFF' },
  { bg: '#14B8A6', text: '#FFFFFF' },
  { bg: '#6366F1', text: '#FFFFFF' },
  { bg: '#EF4444', text: '#FFFFFF' },
  { bg: '#0EA5E9', text: '#FFFFFF' },
  { bg: '#10B981', text: '#FFFFFF' },
  { bg: '#F59E0B', text: '#FFFFFF' },
  { bg: '#6D28D9', text: '#FFFFFF' },
  { bg: '#DC2626', text: '#FFFFFF' },
  { bg: '#0891B2', text: '#FFFFFF' },
  { bg: '#D97706', text: '#FFFFFF' },
  { bg: '#7C3AED', text: '#FFFFFF' },
  { bg: '#059669', text: '#FFFFFF' },
];

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name: string) {
  const hash = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export default function PlayerCard({ player }: Props) {
  const prefs = player.position_preferences ?? [];
  const preferred = prefs.filter((p) => p.preference === 'preferred').map((p) => p.position);
  const avoid = prefs.filter((p) => p.preference === 'avoid').map((p) => p.position);
  const { bg, text } = getAvatarColor(player.name);

  return (
    // Outer View carries shadow; inner View clips triangle to border radius
    <View className="bg-white rounded-xl mx-4 mb-3 border border-gray-100 shadow-sm">
      <View style={{ borderRadius: 12, overflow: 'hidden' }}>
        <GenderCorner gender={player.gender} size={21} />
        <View className="flex-row items-start px-4 pt-4 pb-3">
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
            marginRight: 12, flexShrink: 0,
          }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: text }}>
              {getInitials(player.name)}
            </Text>
          </View>

          <View className="flex-1">
            <Text className="text-gray-900 font-bold text-base">{player.name}</Text>
            {(preferred.length > 0 || avoid.length > 0) && (
              <View className="flex-row flex-wrap gap-1 mt-2">
                {preferred.map((pos) => (
                  <View key={pos} className="bg-green-100 px-2 py-0.5 rounded-full">
                    <Text className="text-green-800 text-xs font-medium">{pos}</Text>
                  </View>
                ))}
                {avoid.map((pos) => (
                  <View key={pos} className="bg-red-100 px-2 py-0.5 rounded-full">
                    <Text className="text-red-700 text-xs font-medium">{pos}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
