import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { useGameStore } from '../../stores/gameStore';

const TEAM_ID = '00000000-0000-0000-0000-000000000001';

export default function ScheduleScreen() {
  const { games, loading, fetchGames, addGame, removeGame } = useGameStore();
  const [processingDate, setProcessingDate] = useState<string | null>(null);

  useEffect(() => { fetchGames(TEAM_ID); }, []);

  const gameDates = new Set(games.map((g) => g.date.slice(0, 10)));

  const markedDates = Object.fromEntries(
    [...gameDates].map((date) => [
      date,
      { marked: true, selected: true, selectedColor: '#2563EB' },
    ])
  );

  async function handleDayPress(day: DateData) {
    const date = day.dateString;
    if (processingDate) return;
    setProcessingDate(date);

    try {
      if (gameDates.has(date)) {
        const game = games.find((g) => g.date.slice(0, 10) === date);
        if (!game) return;
        Alert.alert(
          'Remove Game',
          `Remove game on ${formatDate(date)}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => removeGame(game.id) },
          ]
        );
      } else {
        await addGame(TEAM_ID, date);
      }
    } finally {
      setProcessingDate(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['bottom']}>
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <>
            <Calendar
              markedDates={markedDates}
              onDayPress={handleDayPress}
              theme={{
                backgroundColor: '#F9FAFB',
                calendarBackground: '#FFFFFF',
                selectedDayBackgroundColor: '#2563EB',
                selectedDayTextColor: '#FFFFFF',
                todayTextColor: '#2563EB',
                arrowColor: '#2563EB',
                monthTextColor: '#111827',
                textMonthFontWeight: '700',
                textDayFontSize: 14,
                textMonthFontSize: 16,
                dotColor: '#2563EB',
              }}
              style={{ borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}
            />

            <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 }}>
                {games.length === 0 ? 'No games scheduled' : `${games.length} Game${games.length !== 1 ? 's' : ''} Scheduled`}
              </Text>
              {games.map((game) => (
                <View
                  key={game.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: 'white', borderRadius: 12, padding: 14,
                    marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB',
                  }}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: 10,
                    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>
                      {formatMonth(game.date.slice(0, 10))}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#1D4ED8', lineHeight: 18 }}>
                      {formatDay(game.date.slice(0, 10))}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>
                      {formatDate(game.date.slice(0, 10))}
                    </Text>
                    {game.opponent && (
                      <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>vs {game.opponent}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Remove Game',
                        `Remove game on ${formatDate(game.date.slice(0, 10))}?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => removeGame(game.id) },
                        ]
                      );
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ padding: 4 }}
                  >
                    <Text style={{ fontSize: 20, color: '#9CA3AF', lineHeight: 20 }}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 8 }}>
                Tap a date on the calendar to add or remove a game
              </Text>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });
}

function formatMonth(dateString: string): string {
  const [year, month] = dateString.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
}

function formatDay(dateString: string): string {
  return dateString.split('-')[2].replace(/^0/, '');
}
