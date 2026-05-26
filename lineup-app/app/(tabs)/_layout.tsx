import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTeamStore } from '../../stores/teamStore';

const BRAND = '#2563EB';
const INACTIVE = '#9CA3AF';

const TAB_CONFIG = [
  { name: 'index',    label: 'Team',     icon: 'people-outline',        activeIcon: 'people'         },
  { name: 'schedule', label: 'Schedule', icon: 'calendar-outline',      activeIcon: 'calendar'       },
  { name: 'lineups',  label: 'Lineups',  icon: 'clipboard-outline',     activeIcon: 'clipboard'      },
  { name: 'profile',  label: 'Profile',  icon: 'person-circle-outline', activeIcon: 'person-circle'  },
] as const;

function TeamSwitcherSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { team } = useTeamStore();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{ backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
          <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 }} />
          <View style={{ paddingHorizontal: 20, paddingBottom: 36 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 }}>Your Teams</Text>
            {team ? (
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                paddingVertical: 14, paddingHorizontal: 16,
                backgroundColor: '#EFF6FF', borderRadius: 14, marginBottom: 8,
              }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', marginRight: 12,
                }}>
                  <Ionicons name={'shield' as any} size={18} color="white" />
                </View>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: '#1D4ED8' }}>{team.name}</Text>
                <Ionicons name={'checkmark-circle' as any} size={22} color={BRAND} />
              </View>
            ) : (
              <Text style={{ color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 }}>No teams found</Text>
            )}
            <TouchableOpacity
              onPress={onClose}
              style={{ marginTop: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12 }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type TabBarProps = {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  navigation: { emit: (e: any) => void; navigate: (name: string) => void };
};

function TabBar({ state, navigation }: TabBarProps) {
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <View style={{
        flexDirection: 'row',
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 8,
      }}>
        <TouchableOpacity
          onPress={() => setTeamSheetOpen(true)}
          style={{ flex: 1, alignItems: 'center' }}
          activeOpacity={0.7}
        >
          <View style={{
            backgroundColor: '#DBEAFE',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 5,
            alignItems: 'center',
            gap: 2,
          }}>
            <Ionicons name={'shield-outline' as any} size={22} color={BRAND} />
            <Text style={{ fontSize: 10, color: BRAND, fontWeight: '600' }}>Leagues</Text>
          </View>
        </TouchableOpacity>

        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const cfg = TAB_CONFIG.find(t => t.name === route.name);
          if (!cfg) return null;
          const color = isFocused ? BRAND : INACTIVE;
          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => {
                if (!isFocused) {
                  navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  navigation.navigate(route.name);
                }
              }}
              style={{ flex: 1, alignItems: 'center' }}
              activeOpacity={0.7}
            >
              <Ionicons name={(isFocused ? cfg.activeIcon : cfg.icon) as any} size={24} color={color} />
              <Text style={{ fontSize: 10, color, marginTop: 2 }}>{cfg.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TeamSwitcherSheet visible={teamSheetOpen} onClose={() => setTeamSheetOpen(false)} />
    </>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: '#1E40AF' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ headerShown: false }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="lineups" options={{ headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
