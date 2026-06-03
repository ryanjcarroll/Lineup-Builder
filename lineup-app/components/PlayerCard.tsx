import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Player, playerName, playerGender } from '../types/database';
import GenderCorner from './GenderCorner';

interface Props {
  player: Player;
  onEdit?: () => void;
  isCaptain?: boolean;
  isMe?: boolean;
  isSelected?: boolean;
  genderBorder?: boolean;
  photoUrl?: string | null;
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

const GENDER_BORDER_COLORS = { M: '#3B82F6', F: '#EC4899' } as const;

export default function PlayerCard({ player, onEdit, isCaptain, isMe, isSelected, genderBorder, photoUrl }: Props) {
  const POSITION_ORDER = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  const sortByOrder = (a: string, b: string) => POSITION_ORDER.indexOf(a) - POSITION_ORDER.indexOf(b);
  const prefs = (player.position_preferences ?? []).filter((p) => p.position !== 'LC' && p.position !== 'RC');
  const preferred = prefs.filter((p) => p.preference === 'preferred').map((p) => p.position).sort(sortByOrder);
  const avoid = prefs.filter((p) => p.preference === 'avoid').map((p) => p.position).sort(sortByOrder);
  const isUnlinked = !player.user_id;
  const displayName = playerName(player);
  const displayGender = playerGender(player);
  const { bg, text } = getAvatarColor(displayName);

  return (
    // Outer View carries shadow; inner View clips triangle to border radius
    <View className="bg-white rounded-xl mx-4 mb-3 shadow-sm" style={{
      borderWidth: isSelected ? 2 : 1,
      borderColor: isSelected ? '#2563EB' : '#F3F4F6',
      ...(genderBorder && !isSelected ? { borderLeftWidth: 4, borderLeftColor: GENDER_BORDER_COLORS[displayGender] } : {}),
    }}>
      <View style={{ borderRadius: isSelected ? 11 : 12, overflow: 'hidden', backgroundColor: isSelected ? '#EFF6FF' : 'white' }}>
        {!genderBorder && <GenderCorner gender={displayGender} size={21} />}
        <View className="flex-row items-start px-4 pt-4 pb-3">
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: isSelected ? '#2563EB' : (isUnlinked ? '#F3F4F6' : bg),
            alignItems: 'center', justifyContent: 'center',
            marginRight: 12, flexShrink: 0,
            overflow: 'hidden',
            ...(isUnlinked && !isSelected ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9CA3AF' } : {}),
          }}>
            {isSelected ? (
              <Ionicons name={'checkmark' as any} size={22} color="white" />
            ) : photoUrl ? (
              <Image source={{ uri: photoUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '700', color: isUnlinked ? '#9CA3AF' : text }}>
                {getInitials(displayName)}
              </Text>
            )}
          </View>

          <View className="flex-1">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text className="text-gray-900 font-bold text-base" style={{ flex: 1 }}>{displayName}</Text>
              {isCaptain && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                  <Ionicons name={'shield-checkmark' as any} size={11} color="#1D4ED8" />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#1D4ED8' }}>Captain</Text>
                </View>
              )}
              {isMe && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                  <Ionicons name={'person' as any} size={11} color="#15803D" />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#15803D' }}>Me</Text>
                </View>
              )}
              {isUnlinked && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                  <Ionicons name={'person-outline' as any} size={11} color="#6B7280" />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#6B7280' }}>Unlinked</Text>
                </View>
              )}
              {onEdit && (
                <TouchableOpacity onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 2 }}>
                  <Ionicons name={'pencil' as any} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
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
