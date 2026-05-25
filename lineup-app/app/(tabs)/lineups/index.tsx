import { View, Text, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function LineupsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Lineups' }} />
      <View className="flex-1 px-4 justify-center" style={{ gap: 12 }}>
        <TouchableOpacity
          onPress={() => router.push('/lineups/batting')}
          className="bg-white rounded-2xl p-5 border border-gray-100 flex-row items-center"
          style={{ gap: 16 }}
          activeOpacity={0.7}
        >
          <View className="w-12 h-12 bg-blue-100 rounded-xl items-center justify-center">
            <Ionicons name={'list-outline' as any} size={26} color="#2563EB" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-gray-900">Batting Order</Text>
            <Text className="text-sm text-gray-500 mt-0.5">Set your hitting lineup</Text>
          </View>
          <Ionicons name={'chevron-forward' as any} size={20} color="#D1D5DB" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/lineups/positions')}
          className="bg-white rounded-2xl p-5 border border-gray-100 flex-row items-center"
          style={{ gap: 16 }}
          activeOpacity={0.7}
        >
          <View className="w-12 h-12 bg-green-100 rounded-xl items-center justify-center">
            <Ionicons name={'grid-outline' as any} size={26} color="#16A34A" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-gray-900">Defensive Alignment</Text>
            <Text className="text-sm text-gray-500 mt-0.5">Set your field positions</Text>
          </View>
          <Ionicons name={'chevron-forward' as any} size={20} color="#D1D5DB" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
