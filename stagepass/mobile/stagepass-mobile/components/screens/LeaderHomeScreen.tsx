import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { StagePassButton } from '@/components/StagePassButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, StagePassColors } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

type Props = {
  eventToday: { id: number; name: string } | null;
  onOpenEvent?: (eventId: number) => void;
};

/** Team leader home: check-in + operations dashboard entry */
export function LeaderHomeScreen({ eventToday, onOpenEvent }: Props) {
  const router = useRouter();
  const { colors } = useStagePassTheme();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={[styles.title, { color: StagePassColors.themeBlue }]}>
        Leader Dashboard
      </ThemedText>
      {eventToday ? (
        <>
          <ThemedText style={[styles.eventName, { color: StagePassColors.themeYellow }]}>
            Today: {eventToday.name}
          </ThemedText>
          <StagePassButton
            title="Check in / Event"
            onPress={() => (onOpenEvent ? onOpenEvent(eventToday.id) : router.push(`/events/${eventToday.id}`))}
            variant="primary"
            style={styles.cta}
          />
        </>
      ) : (
        <ThemedText style={[styles.noEvent, { color: colors.textSecondary }]}>
          No event assigned for today
        </ThemedText>
      )}
      <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        Operations
      </ThemedText>
      <StagePassButton
        title="Events"
        onPress={() => router.push('/(tabs)/events')}
        variant="outline"
        style={styles.opsBtn}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.xxl,
    paddingTop: Spacing.section,
  },
  title: {
    marginBottom: Spacing.lg,
  },
  eventName: {
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  cta: {
    marginBottom: Spacing.xl,
  },
  noEvent: {
    fontSize: 15,
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  opsBtn: {
    marginBottom: Spacing.md,
  },
});
