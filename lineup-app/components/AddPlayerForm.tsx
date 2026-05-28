import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';

// CF represents the outfield-center group: tapping it sets LC, CF, and RC together
const FIELD_POSITIONS_ALL = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const CF_GROUP = ['LC', 'CF', 'RC'] as const;

export type PosPrefs = Record<string, 'preferred' | 'avoid' | null>;

interface Props {
  onSubmit: (name: string, gender: 'M' | 'F', posPrefs: PosPrefs) => Promise<void>;
  namePlaceholder?: string;
  submitLabel?: string;
  initialValues?: { name?: string; gender?: 'M' | 'F'; posPrefs?: PosPrefs };
  resetOnSubmit?: boolean;
}

export default function AddPlayerForm({ onSubmit, namePlaceholder = 'Player name', submitLabel = 'Add Player', initialValues, resetOnSubmit = true }: Props) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [gender, setGender] = useState<'M' | 'F'>(initialValues?.gender ?? 'M');
  const [posPrefs, setPosPrefs] = useState<PosPrefs>(initialValues?.posPrefs ?? {});
  const [saving, setSaving] = useState(false);

  function togglePref(pos: string) {
    setPosPrefs((prev) => {
      const cur = prev[pos] ?? null;
      const next: 'preferred' | 'avoid' | null = !cur ? 'preferred' : cur === 'preferred' ? 'avoid' : null;
      if (pos === 'CF') {
        return { ...prev, LC: next, CF: next, RC: next };
      }
      return { ...prev, [pos]: next };
    });
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(name.trim(), gender, posPrefs);
      if (resetOnSubmit) {
        setName('');
        setGender('M');
        setPosPrefs({});
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={namePlaceholder}
        placeholderTextColor="#9CA3AF"
        autoFocus
        returnKeyType="done"
        style={{
          backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB',
          borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
          fontSize: 16, color: '#111827', marginBottom: 20,
        }}
      />

      <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Gender</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
        {(['M', 'F'] as const).map((g) => (
          <TouchableOpacity
            key={g}
            onPress={() => setGender(g)}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
              backgroundColor: gender === g ? (g === 'M' ? '#DBEAFE' : '#FCE7F3') : 'white',
              borderWidth: 1.5,
              borderColor: gender === g ? (g === 'M' ? '#3B82F6' : '#EC4899') : '#E5E7EB',
            }}
          >
            <Text style={{
              fontWeight: '700', fontSize: 15,
              color: gender === g ? (g === 'M' ? '#1D4ED8' : '#BE185D') : '#9CA3AF',
            }}>
              {g === 'M' ? 'Man' : 'Woman'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
        Position Preferences{' '}
        <Text style={{ fontWeight: '400', color: '#9CA3AF' }}>(optional)</Text>
      </Text>
      <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>
        Tap once for preferred · again for avoid · again to clear
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
        {FIELD_POSITIONS_ALL.map((pos) => {
          const pref = posPrefs[pos];
          return (
            <TouchableOpacity
              key={pos}
              onPress={() => togglePref(pos)}
              style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                backgroundColor: pref === 'preferred' ? '#DCFCE7' : pref === 'avoid' ? '#FEE2E2' : 'white',
                borderWidth: 1.5,
                borderColor: pref === 'preferred' ? '#16A34A' : pref === 'avoid' ? '#EF4444' : '#E5E7EB',
              }}
            >
              <Text style={{
                fontSize: 14, fontWeight: '600',
                color: pref === 'preferred' ? '#15803D' : pref === 'avoid' ? '#DC2626' : '#9CA3AF',
              }}>
                {pos}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={saving || !name.trim()}
        style={{
          backgroundColor: '#2563EB', borderRadius: 12,
          paddingVertical: 14, alignItems: 'center',
          opacity: !name.trim() ? 0.4 : 1,
        }}
      >
        {saving
          ? <ActivityIndicator color="white" />
          : <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>{submitLabel}</Text>}
      </TouchableOpacity>
    </>
  );
}
