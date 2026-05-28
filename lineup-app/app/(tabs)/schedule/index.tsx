import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Alert, ActivityIndicator,
  ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, DateData } from 'react-native-calendars';
import { useGameStore } from '../../../stores/gameStore';
import { useTeamStore } from '../../../stores/teamStore';

const DEFAULT_GAME_TIME = new Date(2000, 0, 1, 19, 0); // 7:00 PM

// â”€â”€â”€ Time picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TimeColumn({ label, onUp, onDown }: { label: string; onUp: () => void; onDown: () => void }) {
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <TouchableOpacity onPress={onUp} hitSlop={{ top: 8, bottom: 8, left: 14, right: 14 }}>
        <Ionicons name={'chevron-up' as any} size={22} color="#2563EB" />
      </TouchableOpacity>
      <View style={{
        width: 58, height: 52, backgroundColor: '#F9FAFB',
        borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 26, fontWeight: '700', color: '#111827' }}>{label}</Text>
      </View>
      <TouchableOpacity onPress={onDown} hitSlop={{ top: 8, bottom: 8, left: 14, right: 14 }}>
        <Ionicons name={'chevron-down' as any} size={22} color="#2563EB" />
      </TouchableOpacity>
    </View>
  );
}

function TimePicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const isAM = value.getHours() < 12;
  const displayHour = value.getHours() % 12 || 12;
  const displayMinute = value.getMinutes();

  function adjustHour(delta: number) {
    const next = new Date(value);
    const newDisplay = ((displayHour - 1 + delta + 12) % 12) + 1;
    next.setHours(isAM ? newDisplay % 12 : (newDisplay % 12) + 12);
    onChange(next);
  }

  function adjustMinute(delta: number) {
    const next = new Date(value);
    next.setMinutes(((Math.round(displayMinute / 5) * 5 + delta * 5) + 60) % 60);
    onChange(next);
  }

  function toggleAMPM() {
    const next = new Date(value);
    next.setHours((next.getHours() + 12) % 24);
    onChange(next);
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <TimeColumn
        label={String(displayHour)}
        onUp={() => adjustHour(1)}
        onDown={() => adjustHour(-1)}
      />
      <Text style={{ fontSize: 28, fontWeight: '700', color: '#111827', marginTop: 2 }}>:</Text>
      <TimeColumn
        label={String(displayMinute).padStart(2, '0')}
        onUp={() => adjustMinute(1)}
        onDown={() => adjustMinute(-1)}
      />
      <View style={{ gap: 6 }}>
        <TouchableOpacity
          onPress={() => { if (!isAM) toggleAMPM(); }}
          style={{
            paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
            backgroundColor: isAM ? '#2563EB' : '#F3F4F6',
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: isAM ? 'white' : '#9CA3AF' }}>AM</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { if (isAM) toggleAMPM(); }}
          style={{
            paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
            backgroundColor: !isAM ? '#2563EB' : '#F3F4F6',
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: !isAM ? 'white' : '#9CA3AF' }}>PM</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatTimeFromDate(d: Date): string {
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = d.getHours() < 12 ? 'AM' : 'PM';
  return `${h}:${m} ${ampm}`;
}

// â”€â”€â”€ Screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ScheduleScreen() {
  const { games, loading, fetchGames, addGame, removeGame } = useGameStore();
  const { team } = useTeamStore();

  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [opponent, setOpponent] = useState('');
  const [gameTime, setGameTime] = useState<Date>(DEFAULT_GAME_TIME);
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (team?.id) fetchGames(team.id); }, [team?.id]);

  const gameDates = new Set(games.map((g) => g.date.slice(0, 10)));

  const markedDates = Object.fromEntries(
    [...gameDates].map((date) => [
      date,
      { marked: true, selected: true, selectedColor: '#2563EB' },
    ])
  );

  function handleDayPress(day: DateData) {
    const date = day.dateString;
    if (gameDates.has(date)) {
      const game = games.find((g) => g.date.slice(0, 10) === date);
      if (!game) return;
      Alert.alert(
        'Remove Game',
        `Remove game on ${formatDate(date)}?`,
        [
          { text: 'Back', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => removeGame(game.id) },
        ]
      );
    } else {
      setPendingDate(date);
      setOpponent('');
      setGameTime(new Date(DEFAULT_GAME_TIME));
    }
  }

  async function handleCreate() {
    if (!pendingDate) return;
    setCreating(true);
    try {
      await addGame(team!.id, pendingDate, {
        opponent: opponent.trim() || undefined,
        startTime: formatTimeFromDate(gameTime),
      });
      setPendingDate(null);
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Schedule' }} />
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

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
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
                    {game.start_time && (
                      <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>{game.start_time}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Remove Game',
                        `Remove game on ${formatDate(game.date.slice(0, 10))}?`,
                        [
                          { text: 'Back', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => removeGame(game.id) },
                        ]
                      );
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name={'close' as any} size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              ))}
              <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 8 }}>
                Tap a date to add · tap a scheduled date to remove
              </Text>
            </ScrollView>
          </>
        )}
      </View>

      {/* New Game bottom sheet */}
      <Modal visible={pendingDate !== null} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPendingDate(null)} />
            <View style={{ backgroundColor: '#F3F4F6', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
              <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 12 }} />
              <Text style={{
                fontSize: 17, fontWeight: '700', color: '#111827',
                textAlign: 'center', paddingVertical: 16,
              }}>
                New Game
              </Text>

              <View style={{ paddingHorizontal: 20, paddingBottom: 36 }}>
                {/* Date (read-only) */}
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Date</Text>
                <View style={{
                  backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
                  borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
                }}>
                  <Text style={{ fontSize: 16, color: '#111827' }}>
                    {pendingDate ? formatDate(pendingDate) : ''}
                  </Text>
                </View>

                {/* Opponent */}
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
                  Opponent <Text style={{ fontWeight: '400', color: '#9CA3AF' }}>(optional)</Text>
                </Text>
                <TextInput
                  value={opponent}
                  onChangeText={setOpponent}
                  placeholder="e.g. Lightning Bolts"
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="done"
                  style={{
                    backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB',
                    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                    fontSize: 16, color: '#111827', marginBottom: 20,
                  }}
                />

                {/* Start time */}
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 14 }}>
                  Start Time
                </Text>
                <TimePicker value={gameTime} onChange={setGameTime} />

                <TouchableOpacity
                  onPress={handleCreate}
                  disabled={creating}
                  style={{
                    backgroundColor: '#2563EB', borderRadius: 12,
                    paddingVertical: 14, alignItems: 'center', marginTop: 24,
                  }}
                >
                  {creating
                    ? <ActivityIndicator color="white" />
                    : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Create Event</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

