import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Event } from '~/services/api';
import { AppHeader } from '@/components/AppHeader';
import { EventCard } from '@/components/EventCard';
import { StagepassLoader } from '@/components/StagepassLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

function isUpcoming(dateStr: string): boolean {
  try {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() >= today.getTime();
  } catch {
    return true;
  }
}

function sortByDate(a: Event, b: Event): number {
  try {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  } catch {
    return 0;
  }
}

const TAB_BAR_HEIGHT = 56;

export default function EventsTab() {
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollBottomPadding = insets.bottom + TAB_BAR_HEIGHT + Spacing.lg;

  const loadEvents = useCallback(async () => {
    try {
      const res = await api.events.list();
      const list = Array.isArray(res?.data) ? res.data : [];
      setEvents(list.sort(sortByDate));
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

  if (loading) {
    return <StagepassLoader message="Loading events…" fullScreen />;
  }

  const upcoming = events.filter((e) => isUpcoming(e.date));
  const past = events.filter((e) => !isUpcoming(e.date));

  const renderSection = (title: string, count: number, data: Event[], isUpcoming: boolean) => {
    if (data.length === 0) return null;
    const useYellowBadge = isUpcoming;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {title}
          </ThemedText>
          <View style={[
            styles.countBadge,
            { backgroundColor: useYellowBadge ? themeYellow + '22' : themeBlue + '18' },
          ]}>
            <ThemedText style={[styles.countText, { color: useYellowBadge ? themeBlue : themeBlue }]}>
              {count}
            </ThemedText>
          </View>
        </View>
        {data.map((item) => (
          <EventCard
            key={item.id}
            event={item}
            onPress={() => router.push({ pathname: '/events/[id]', params: { id: String(item.id) } })}
          />
        ))}
      </View>
    );
  };

  const empty = events.length === 0;

  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <View style={styles.content}>
        <View style={[styles.hero, { backgroundColor: themeBlue + '0c', borderColor: colors.border }]}>
          <View style={[styles.heroIconWrap, { backgroundColor: themeBlue, borderColor: themeYellow }]}>
            <Ionicons name="calendar" size={28} color="#fff" />
          </View>
          <View style={styles.heroTextBlock}>
            <ThemedText style={[styles.heroTitle, { color: colors.text }]}>
              My Events
            </ThemedText>
            <ThemedText style={[styles.heroSub, { color: colors.textSecondary }]}>
              Tap an event for{' '}
              <ThemedText style={[styles.heroSubAccent, { color: themeBlue }]}>details and check-in</ThemedText>
            </ThemedText>
          </View>
          <View style={[styles.heroAccent, { backgroundColor: themeYellow }]} />
        </View>

        {empty ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.surface, borderColor: themeYellow }]}>
              <Ionicons name="calendar-outline" size={48} color={themeBlue} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
              No events yet
            </ThemedText>
            <ThemedText style={[styles.emptySub, { color: colors.textSecondary }]}>
              Your assigned events will appear here. Pull down to refresh.
            </ThemedText>
            <Pressable
              onPress={onRefresh}
              style={({ pressed }) => [styles.emptyButton, { opacity: pressed ? 0.9 : 1 }]}
            >
              <ThemedText style={styles.emptyButtonText}>Refresh events</ThemedText>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.list, { paddingBottom: scrollBottomPadding }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={themeBlue}
              />
            }
          >
            {renderSection('Upcoming', upcoming.length, upcoming, true)}
            {renderSection('Past', past.length, past, false)}
          </ScrollView>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: Spacing.xl },
  hero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTextBlock: { flex: 1, minWidth: 120 },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  heroSub: {
    fontSize: 14,
    marginTop: 2,
  },
  heroSubAccent: {
    fontWeight: '600',
  },
  heroAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
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
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  emptySub: {
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 260,
    marginBottom: Spacing.lg,
  },
  emptyButton: {
    backgroundColor: themeYellow,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: themeBlue,
  },
});
