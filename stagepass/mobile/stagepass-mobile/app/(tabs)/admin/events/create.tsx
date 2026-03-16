/**
 * Admin: create a new event.
 * Elegant form with date/time pickers and Google Places location (same as web admin).
 * KeyboardAvoidingView + scroll so the keyboard doesn’t obscure fields.
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { LocationSearchInput } from '@/components/LocationSearchInput';
import { StagePassButton } from '@/components/StagePassButton';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api } from '~/services/api';
import { hasGooglePlacesKey } from '~/services/googlePlaces';

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toHM(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDisplayTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
}

const getDefaultDate = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const getDefaultStartTime = () => {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
};
const getDefaultEndTime = () => {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  return d;
};

/** Approximate header bar height (back + title + padding) for keyboard offset */
const HEADER_BAR_HEIGHT = 52;

export default function AdminCreateEventScreen() {
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const keyboardVerticalOffset = insets.top + HEADER_BAR_HEIGHT;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState<Date>(getDefaultDate);
  const [eventEndDate, setEventEndDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<Date>(getDefaultStartTime);
  const [endTime, setEndTime] = useState<Date>(getDefaultEndTime);
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Required', 'Event name is required.');
      return;
    }
    setSubmitting(true);
    try {
      const event = await api.events.create({
        name: trimmedName,
        date: toYMD(eventDate),
        end_date: eventEndDate ? toYMD(eventEndDate) : undefined,
        start_time: toHM(startTime),
        expected_end_time: toHM(endTime),
        location_name: locationName.trim() || undefined,
        latitude,
        longitude,
        description: description.trim() || undefined,
      });
      Alert.alert('Created', 'Event has been created.', [
        {
          text: 'Manage',
          onPress: () =>
            router.replace({ pathname: '/admin/events/[id]/operations', params: { id: String(event.id) } }),
        },
        { text: 'Back to list', onPress: () => router.replace('/admin/events') },
      ]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create event.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDateChange = (_: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selected) setEventDate(selected);
  };
  const onEndDateChange = (_: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setShowEndDatePicker(false);
    if (selected) setEventEndDate(selected);
  };
  const onStartTimeChange = (_: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setShowStartTimePicker(false);
    if (selected) setStartTime(selected);
  };
  const onEndTimeChange = (_: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setShowEndTimePicker(false);
    if (selected) setEndTime(selected);
  };

  const sectionLabel = [styles.sectionLabel, { color: colors.textSecondary }];
  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const pickerRow = [styles.pickerRow, { borderColor: colors.border }];
  const pickerRowText = [styles.pickerRowText, { color: colors.text }];
  const pickerRowSub = [styles.pickerRowSub, { color: colors.textSecondary }];

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Create event" showBack onBack={() => router.replace('/admin/events')} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + Spacing.xxl + 280 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={true}
        >
          {/* Basics */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
              <Ionicons name="document-text-outline" size={20} color={themeYellow} />
              <ThemedText style={sectionLabel}>Basics</ThemedText>
            </View>
            <View style={card}>
              <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Event name *</ThemedText>
              <StagePassInput value={name} onChangeText={setName} placeholder="Event name" style={styles.input} />
              <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Description</ThemedText>
              <StagePassInput
                value={description}
                onChangeText={setDescription}
                placeholder="Optional description"
                multiline
                numberOfLines={3}
                style={styles.input}
              />
            </View>
          </View>

          {/* Date & time */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
              <Ionicons name="calendar-outline" size={20} color={themeYellow} />
              <ThemedText style={sectionLabel}>Date & time</ThemedText>
            </View>
            <View style={card}>
              <Pressable
                onPress={() => {
                  setShowStartTimePicker(false);
                  setShowEndTimePicker(false);
                  setShowDatePicker(true);
                }}
                style={({ pressed }) => [...pickerRow, pressed && styles.pickerRowPressed]}
              >
                <View>
                  <ThemedText style={pickerRowSub}>Date</ThemedText>
                  <ThemedText style={pickerRowText}>{formatDisplayDate(eventDate)}</ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={eventDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange}
                  minimumDate={new Date()}
                />
              )}
              {Platform.OS === 'ios' && showDatePicker && (
                <Pressable onPress={() => setShowDatePicker(false)} style={styles.doneRow}>
                  <ThemedText style={[styles.doneText, { color: themeYellow }]}>Done</ThemedText>
                </Pressable>
              )}

              <Pressable
                onPress={() => {
                  setShowDatePicker(false);
                  setShowStartTimePicker(false);
                  setShowEndTimePicker(false);
                  setShowEndDatePicker(true);
                }}
                style={({ pressed }) => [...pickerRow, pressed && styles.pickerRowPressed]}
              >
                <View>
                  <ThemedText style={pickerRowSub}>End date (multi-day)</ThemedText>
                  <ThemedText style={pickerRowText}>
                    {eventEndDate ? formatDisplayDate(eventEndDate) : 'Single day'}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
              {showEndDatePicker && (
                <DateTimePicker
                  value={eventEndDate ?? eventDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onEndDateChange}
                  minimumDate={eventDate}
                />
              )}
              {Platform.OS === 'ios' && showEndDatePicker && (
                <View style={styles.doneRow}>
                  <Pressable onPress={() => setShowEndDatePicker(false)}>
                    <ThemedText style={[styles.doneText, { color: themeYellow }]}>Done</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => { setEventEndDate(null); setShowEndDatePicker(false); }}>
                    <ThemedText style={[styles.doneText, { color: colors.textSecondary }]}>Clear (single day)</ThemedText>
                  </Pressable>
                </View>
              )}

              <Pressable
                onPress={() => {
                  setShowDatePicker(false);
                  setShowEndDatePicker(false);
                  setShowEndTimePicker(false);
                  setShowStartTimePicker(true);
                }}
                style={({ pressed }) => [...pickerRow, pressed && styles.pickerRowPressed]}
              >
                <View>
                  <ThemedText style={pickerRowSub}>Start time</ThemedText>
                  <ThemedText style={pickerRowText}>{formatDisplayTime(startTime)}</ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
              {showStartTimePicker && (
                <DateTimePicker
                  value={startTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onStartTimeChange}
                  is24Hour={false}
                />
              )}
              {Platform.OS === 'ios' && showStartTimePicker && (
                <Pressable onPress={() => setShowStartTimePicker(false)} style={styles.doneRow}>
                  <ThemedText style={[styles.doneText, { color: themeYellow }]}>Done</ThemedText>
                </Pressable>
              )}

              <Pressable
                onPress={() => {
                  setShowDatePicker(false);
                  setShowStartTimePicker(false);
                  setShowEndTimePicker(true);
                }}
                style={({ pressed }) => [...pickerRow, pressed && styles.pickerRowPressed, { borderBottomWidth: 0 }]}
              >
                <View>
                  <ThemedText style={pickerRowSub}>End time</ThemedText>
                  <ThemedText style={pickerRowText}>{formatDisplayTime(endTime)}</ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
              {showEndTimePicker && (
                <DateTimePicker
                  value={endTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onEndTimeChange}
                  is24Hour={false}
                />
              )}
              {Platform.OS === 'ios' && showEndTimePicker && (
                <Pressable onPress={() => setShowEndTimePicker(false)} style={styles.doneRow}>
                  <ThemedText style={[styles.doneText, { color: themeYellow }]}>Done</ThemedText>
                </Pressable>
              )}
            </View>
          </View>

          {/* Location (Google Places – same as web admin) */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
              <Ionicons name="location-outline" size={20} color={themeYellow} />
              <ThemedText style={sectionLabel}>Location</ThemedText>
            </View>
            <View style={card}>
              <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
                Search venue or address
              </ThemedText>
              <LocationSearchInput
                value={locationName}
                onChange={setLocationName}
                onSelect={(result) => {
                  setLocationName(result.location_name);
                  setLatitude(result.latitude);
                  setLongitude(result.longitude);
                }}
                placeholder="Search for a venue or address…"
                style={styles.input}
              />
              {!hasGooglePlacesKey() && (
                <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>
                  Add EXPO_PUBLIC_GOOGLE_PLACES_API_KEY or VITE_GOOGLE_MAPS_API_KEY to .env and restart Expo for search.
                </ThemedText>
              )}
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <StagePassButton
              title="Cancel"
              variant="outline"
              onPress={() => router.replace('/admin/events')}
              disabled={submitting}
              style={styles.actionBtn}
            />
            <StagePassButton
              title={submitting ? 'Creating…' : 'Create event'}
              onPress={handleSubmit}
              disabled={submitting}
              style={[styles.actionBtn, { backgroundColor: themeYellow }]}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionTitleAccent: { width: 3, height: 16, borderRadius: 0 },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  label: { fontSize: 13, marginBottom: Spacing.xs, fontWeight: '600' },
  input: { marginBottom: Spacing.md },
  hint: { fontSize: 12, marginTop: Spacing.xs, marginBottom: Spacing.sm },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerRowPressed: { opacity: 0.7 },
  pickerRowText: { fontSize: 16, fontWeight: '600' },
  pickerRowSub: { fontSize: 12, marginBottom: 2 },
  doneRow: {
    paddingVertical: Spacing.sm,
    alignItems: 'flex-end',
  },
  doneText: { fontSize: 16, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  actionBtn: {
    flex: 1,
  },
});
