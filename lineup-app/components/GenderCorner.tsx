import { View } from 'react-native';

const COLORS = { M: '#3B82F6', F: '#EC4899' } as const;

export default function GenderCorner({ gender, size = 12 }: { gender: 'M' | 'F'; size?: number }) {
  return (
    <View style={{
      position: 'absolute', top: 0, left: 0,
      width: 0, height: 0,
      borderTopWidth: size, borderTopColor: COLORS[gender],
      borderRightWidth: size, borderRightColor: 'transparent',
    }} />
  );
}
