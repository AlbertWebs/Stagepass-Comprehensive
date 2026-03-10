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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Event } from '~/services/api';
import { HomeHeader } from '@/components/HomeHeader';
import { DateStrip } from '@/components/DateStrip';
import { EventCard } from '@/components/EventCard';
import { StagepassLoader } from '@/components/StagepassLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

const TAB_BAR_HEIGHT = 58;

function eventMatchesDate(event: Event, date: Date): boolean {
  try {
    const d = new Date(event.date);
    d.setHours(0, 0, 0, 0);
    const sel = new Date(date);
    sel.setHours(0, 0, 0, 0);
    return d.getTime() === sel.getTime();
  } catch {
    return false;
  }
}

function sortByTime(a: Event, b: Event): number {
  try {
    const tA = (a.start_time || '').replace(':', '');
    const tB = (b.start_time || '').replace(':', '');
    return tA.localeCompare(tB) || new Date(a.date).getTime() - new Date(b.date).getTime();
  } catch {
    return 0;
  }
}

export default function EventsTab() {
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const scrollBottomPadding = insets.bottom + TAB_BAR_HEIGHT + Spacing.sm;

  const loadEvents = useCallback(async () => {
    try {
      const res = await api.events.list();
      const list = Array.isArray(res?.data) ? res.data : [];
      setEvents(list.sort(sortByTime));
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

  const eventsOnSelectedDate = useMemo(
    () => events.filter((e) => eventMatchesDate(e, selectedDate)),
    [events, selectedDate]
  );

  if (loading) {
    return <StagepassLoader message="Loading events…" fullScreen />;
  }

  const sectionTitle = (() => {
    const d = new Date(selectedDate);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) return "Today's Events";
    return 'Events';
  })();

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="My Events" />
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        <View style={[styles.dateStripWrap, { backgroundColor: colors.surface }]}>
          <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        </View>

        <View style={styles.sectionHeader}>
          <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
          <Ionicons name="calendar" size={20} color={themeYellow} style={styles.sectionIcon} />
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            {sectionTitle}
          </ThemedText>
        </View>

        {events.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.surface, borderColor: themeYellow }]}>
              <Ionicons name="calendar-outline" size={48} color={themeYellow} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
              No events yet
            </ThemedText>
            <ThemedText style={[styles.emptySub, { color: colors.textSecondary }]}>
              Your assigned events will appear here. Pull down to refresh.
            </ThemedText>
            <Pressable
              onPress={onRefresh}
              style={({ pressed }) => [
                styles.emptyButton,
                { opacity: pressed ? 0.9 : 1, backgroundColor: themeYellow },
              ]}
            >
              <ThemedText style={styles.emptyButtonText}>Refresh events</ThemedText>
            </Pressable>
          </View>
        ) : eventsOnSelectedDate.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconWrapSmall, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="today-outline" size={32} color={colors.textSecondary} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
              No events on this day
            </ThemedText>
            <ThemedText style={[styles.emptySub, { color: colors.textSecondary }]}>
              Select another date or pull down to refresh.
            </ThemedText>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.list, { paddingBottom: scrollBottomPadding }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={themeYellow}
              />
            }
          >
            {eventsOnSelectedDate.map((item) => (
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
                onPress={() => router.push({ pathname: '/events/[id]', params: { id: String(item.id) } })}
              />
            ))}
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
  dateStripWrap: {
    marginHorizontal: -Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(234, 179, 8, 0.2)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitleAccent: {
    width: 4,
    height: 22,
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  sectionIcon: {
    marginRight: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  list: {
    paddingBottom: Spacing.xxl * 2,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: Spacing.lg,
    shadowColor: themeYellow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  emptyIconWrapSmall: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: Spacing.sm,
    letterSpacing: 0.2,
  },
  emptySub: {
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  emptyButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    shadowColor: themeBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: themeBlue,
  },
});
