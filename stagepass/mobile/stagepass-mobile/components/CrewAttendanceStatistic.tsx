/**
 * Crew Attendance Statistic – events check-in streak only.
 * Streak starts at 100% and drops for each allocated event not checked in.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { ThemedText } from '@/components/themed-text';
import { Typography } from '@/constants/ui';
import { BorderRadius, Spacing, StatusColors } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api } from '~/services/api';

const RING_SIZE = 100;
const RING_STROKE = 10;
const HALF = RING_SIZE / 2;
const RADIUS = HALF - RING_STROKE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function getRingColor(percentage: number): string {
  if (percentage >= 90) return StatusColors.checkedIn;
  if (percentage >= 70) return StatusColors.pending;
  return StatusColors.missing;
}

export type AttendanceStats = {
  total_assigned: number;
  checked_in: number;
  missed: number;
  attendance_percentage: number;
  office_checkins_last_30?: number;
  expected_office_weekdays?: number;
  pull_up_percentage?: number;
  /** Office streak: 100% minus each missed weekday in period. */
  office_streak_percentage?: number;
  /** Events streak: 100% minus each allocated event not checked in. */
  events_streak_percentage?: number;
};

type Props = {
  stats?: AttendanceStats | null;
  enablePulse?: boolean;
  onStatsLoaded?: (stats: AttendanceStats) => void;
  refreshTrigger?: string | null;
};

function SingleRing({
  percentage,
  label,
  sublabel,
  colors,
  isDark,
}: {
  percentage: number;
  label: string;
  sublabel: string;
  colors: { text: string; textSecondary: string; border: string };
  isDark: boolean;
}) {
  const ringColor = getRingColor(percentage);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      200,
      withTiming(percentage / 100, { duration: 800, easing: Easing.out(Easing.cubic) })
    );
  }, [percentage]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={styles.svgRing}>
        <Circle
          cx={HALF}
          cy={HALF}
          r={RADIUS}
          stroke={isDark ? colors.border : `${ringColor}22`}
          strokeWidth={RING_STROKE}
          fill="transparent"
        />
        <AnimatedCircle
          cx={HALF}
          cy={HALF}
          r={RADIUS}
          stroke={ringColor}
          strokeWidth={RING_STROKE}
          fill="transparent"
          strokeDasharray={CIRCUMFERENCE}
          strokeLinecap="round"
          transform={`rotate(-90 ${HALF} ${HALF})`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <ThemedText style={[styles.ringPercent, { color: colors.text }]}>{Math.round(percentage)}%</ThemedText>
      </View>
      <ThemedText style={[styles.ringLabel, { color: colors.text }]}>{label}</ThemedText>
      <ThemedText style={[styles.ringSub, { color: colors.textSecondary }]}>{sublabel}</ThemedText>
    </View>
  );
}

/** Faint blue card background – matches HomeDashboardScreen cards (premium look). */
const cardBg = (isDark: boolean) => (isDark ? '#1E212A' : '#F5F7FC');

export function CrewAttendanceStatistic({ stats: statsProp, onStatsLoaded, refreshTrigger }: Props) {
  const { colors, isDark } = useStagePassTheme();
  const [fetchedStats, setFetchedStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const stats = statsProp !== undefined ? statsProp : fetchedStats;

  useEffect(() => {
    if (statsProp !== undefined) return;
    let cancelled = false;
    setLoading(true);
    api.attendance
      .stats()
      .then((data) => {
        if (!cancelled) {
          setFetchedStats(data);
          onStatsLoaded?.(data);
        }
      })
      .catch(() => {
        if (!cancelled) setFetchedStats(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statsProp, onStatsLoaded, refreshTrigger]);

  const totalAssigned = stats?.total_assigned ?? 0;
  const checkedIn = stats?.checked_in ?? 0;

  const eventsPct = stats?.events_streak_percentage ?? (totalAssigned === 0 ? 100 : Math.round((checkedIn / totalAssigned) * 1000) / 10);

  const eventsSublabel = totalAssigned > 0 ? `${checkedIn}/${totalAssigned} checked in` : '—';

  return (
    <View style={[styles.wrap, { backgroundColor: cardBg(isDark), borderColor: colors.border }]}>
      {loading && stats == null ? (
        <ThemedText style={[styles.loading, { color: colors.textSecondary }]}>Loading…</ThemedText>
      ) : (
        <>
          <View style={styles.ringsRow}>
            <SingleRing
              percentage={eventsPct}
              label="Events check-in"
              sublabel={eventsSublabel}
              colors={colors}
              isDark={isDark}
            />
          </View>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: StatusColors.checkedIn + '18', borderColor: StatusColors.checkedIn + '40' }]}>
              <Ionicons name="checkmark-circle" size={14} color={StatusColors.checkedIn} />
              <ThemedText style={[styles.badgeText, { color: colors.text }]}>
                Events: {eventsSublabel}
              </ThemedText>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  loading: {
    fontSize: Typography.buttonText,
    paddingVertical: Spacing.lg,
  },
  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  ringWrap: {
    width: RING_SIZE,
    minHeight: RING_SIZE + 36,
    alignItems: 'center',
  },
  svgRing: {
    position: 'absolute',
    top: 0,
  },
  ringCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPercent: {
    fontSize: Typography.titleHero,
    fontWeight: Typography.statValueWeight,
    letterSpacing: 0.5,
  },
  ringLabel: {
    fontSize: Typography.label,
    fontWeight: Typography.titleCardWeight,
    marginTop: RING_SIZE + 4,
    letterSpacing: 0.2,
  },
  ringSub: {
    fontSize: Typography.titleSection,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: Typography.label,
    fontWeight: Typography.labelWeight,
  },
});
