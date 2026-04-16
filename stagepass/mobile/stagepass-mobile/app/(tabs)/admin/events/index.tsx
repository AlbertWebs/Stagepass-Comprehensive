/**
 * Admin: Projects – list events by Today, Upcoming, Past + Create event button.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { api, type Event } from '~/services/api';
import { AppHeader } from '@/components/AppHeader';
import { EventCard } from '@/components/EventCard';
import { StagepassLoader } from '@/components/StagepassLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { NAV_PRESSED_OPACITY, useNavigationPress } from '@/src/utils/navigationPress';

const TAB_BAR_HEIGHT = 56;
const U = { sm: 8, md: 12, lg: 16 };

function sortByDateThenTime(a: Event, b: Event): number {
  const d = new Date(a.date).getTime() - new Date(b.date).getTime();
  if (d !== 0) return d;
  const tA = (a.start_time || '').replace(':', '');
  const tB = (b.start_time || '').replace(':', '');
  return tA.localeCompare(tB);
}

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function eventDateOnly(event: Event): string {
  if (!event.date || typeof event.date !== 'string') return '';
  const s = String(event.date).trim();
  return s.length >= 10 ? s.substring(0, 10) : s;
}

type Segment = 'today' | 'upcoming' | 'past';

function getSegment(event: Event): Segment {
  const dateStr = eventDateOnly(event);
  const today = todayDateString();
  if (dateStr === today) return 'today';
  if (dateStr < today) return 'past';
  return 'upcoming';
}

export default function AdminEventsListScreen() {
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const handleNav = useNavigationPress();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const bottomPad = TAB_BAR_HEIGHT;

  const loadEvents = useCallback(async () => {
    try {
      const res = await api.events.list({ per_page: 100 });
      const list = Array.isArray(res?.data) ? res.data : [];
      setEvents(list.sort(sortByDateThenTime));
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEvents();
  }, [loadEvents]);

  const { today, upcoming, past } = useMemo(() => {
    const t: Event[] = [];
    const u: Event[] = [];
    const p: Event[] = [];
    events.forEach((ev) => {
      const seg = getSegment(ev);
      if (seg === 'today') t.push(ev);
      else if (seg === 'upcoming') u.push(ev);
      else p.push(ev);
    });
    return { today: t, upcoming: u, past: p };
  }, [events]);

  const openEventOps = (id: number) => {
    handleNav(() => router.push({ pathname: '/(tabs)/admin/events/[id]/operations', params: { id: String(id) } }));
  };

  const openEventEdit = (id: number) => {
    handleNav(() => router.push({ pathname: '/(tabs)/admin/events/[id]/edit', params: { id: String(id) } }));
  };

  const renderSection = (title: string, list: Event[], accentColor: string) => {
    if (list.length === 0) return null;
    return (
      <View style={styles.section} key={title}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionAccent, { backgroundColor: accentColor }]} />
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{title}</ThemedText>
          <ThemedText style={[styles.sectionCount, { color: colors.textSecondary }]}>{list.length}</ThemedText>
        </View>
        {list.map((item) => (
          <EventCard
            key={item.id}
            event={{
              id: item.id,
              name: item.name,
              date: item.date,
              start_time: item.start_time,
              expected_end_time: item.expected_end_time,
              location_name: item.location_name,
              status: item.status,
            }}
            onPress={() => openEventOps(item.id)}
            extraActions={[
              { label: 'Edit', onPress: () => openEventEdit(item.id), icon: 'pencil-outline' },
              { label: 'Crew', onPress: () => handleNav(() => router.push({ pathname: '/(tabs)/admin/events/[id]/crew', params: { id: String(item.id) } })), icon: 'people-outline' },
              { label: 'Operations', onPress: () => openEventOps(item.id), icon: 'settings-outline' },
            ]}
          />
        ))}
      </View>
    );
  };

  if (loading) {
    return <StagepassLoader message="Loading projects…" fullScreen />;
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Events" />
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        <Pressable
          style={({ pressed }) => [
            styles.createBtn,
            { backgroundColor: themeYellow, opacity: pressed ? NAV_PRESSED_OPACITY : 1 },
          ]}
          onPress={() => handleNav(() => router.push('/(tabs)/admin/events/create'))}
        >
          <Ionicons name="add-circle" size={24} color={themeBlue} />
          <ThemedText style={styles.createBtnText}>Create event</ThemedText>
        </Pressable>

        {events.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconWrap, { borderColor: themeYellow, backgroundColor: themeBlue }]}>
              <Ionicons name="folder-open-outline" size={44} color={themeYellow} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No projects yet</ThemedText>
            <ThemedText style={[styles.emptySub, { color: colors.textSecondary }]}>
              Create your first event to get started.
            </ThemedText>
            <Pressable
              style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? NAV_PRESSED_OPACITY : 1 }]}
              onPress={() => handleNav(() => router.push('/(tabs)/admin/events/create'))}
            >
              <ThemedText style={styles.emptyBtnText}>Create event</ThemedText>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad + U.lg }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeYellow} />
            }
          >
            {renderSection('Today', today, themeYellow)}
            {renderSection('Upcoming', upcoming, themeBlue)}
            {renderSection('Past', past, colors.textSecondary)}
          </ScrollView>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: themeBlue,
    shadowColor: themeBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  createBtnText: { fontSize: 17, fontWeight: '700', color: themeBlue },
  list: { paddingTop: U.sm },
  section: { marginBottom: U.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: U.md,
    gap: U.sm,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 1.5,
    paddingHorizontal: Spacing.xl,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    shadowColor: themeBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: Spacing.sm },
  emptySub: {
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  emptyBtn: {
    backgroundColor: themeYellow,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: themeBlue,
  },
  emptyBtnText: { fontSize: 16, fontWeight: '700', color: themeBlue },
});
