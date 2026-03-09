/**
 * Admin: list all events with Create, Edit, Delete, Crew, Operations.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { StagePassButton } from '@/components/StagePassButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api, type Event } from '~/services/api';

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
}

export default function AdminEventsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useStagePassTheme();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.events.list();
      setEvents(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handleDelete = (event: Event) => {
    Alert.alert(
      'Delete event',
      `Delete "${event.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.events.delete(event.id);
              setEvents((prev) => prev.filter((e) => e.id !== event.id));
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete event.');
            }
          },
        },
      ]
    );
  };

  const bottomPad = insets.bottom + Spacing.xxl;

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Events" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeBlue} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Events" />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeBlue} />}
        showsVerticalScrollIndicator={false}
      >
        <StagePassButton
          title="Create event"
          onPress={() => router.push('/admin/events/create' as any)}
          style={styles.createBtn}
        />
        {events.length === 0 ? (
          <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>No events yet.</ThemedText>
        ) : (
          events.map((event) => (
            <View
              key={event.id}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Pressable
                onPress={() => router.push(`/events/${event.id}` as any)}
                style={styles.cardMain}
              >
                <ThemedText style={[styles.eventName, { color: colors.text }]} numberOfLines={2}>
                  {event.name}
                </ThemedText>
                <ThemedText style={[styles.eventMeta, { color: colors.textSecondary }]}>
                  {formatDate(event.date)} · {event.location_name || 'No location'}
                </ThemedText>
                <ThemedText style={[styles.eventStatus, { color: themeYellow }]}>{event.status}</ThemedText>
              </Pressable>
              <View style={styles.actions}>
                <Pressable
                  onPress={() => router.push({ pathname: '/admin/events/[id]/edit', params: { id: String(event.id) } } as any)}
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="pencil" size={20} color={themeBlue} />
                  <ThemedText style={[styles.actionLabel, { color: themeBlue }]}>Edit</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => router.push({ pathname: '/admin/events/[id]/crew', params: { id: String(event.id) } } as any)}
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="people" size={20} color={themeBlue} />
                  <ThemedText style={[styles.actionLabel, { color: themeBlue }]}>Crew</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => router.push({ pathname: '/admin/events/[id]/operations', params: { id: String(event.id) } } as any)}
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="checkbox" size={20} color={themeBlue} />
                  <ThemedText style={[styles.actionLabel, { color: themeBlue }]}>Ops</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => handleDelete(event)}
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                  <ThemedText style={[styles.actionLabel, { color: colors.error }]}>Delete</ThemedText>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: Spacing.lg },
  createBtn: { marginBottom: Spacing.xl, backgroundColor: themeYellow },
  empty: { textAlign: 'center', paddingVertical: Spacing.xxl, fontSize: 15 },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardMain: { marginBottom: Spacing.md },
  eventName: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  eventMeta: { fontSize: 13, marginBottom: 2 },
  eventStatus: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingRight: Spacing.sm },
  actionLabel: { fontSize: 13, fontWeight: '600' },
});
