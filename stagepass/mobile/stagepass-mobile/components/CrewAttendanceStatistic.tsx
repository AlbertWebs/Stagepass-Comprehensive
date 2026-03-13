/**
 * Crew Attendance Statistic – circular progress ring, center percentage,
 * supporting text and badges. Animated on mount; optional pulse when ≥95%.
 * Ring is drawn with react-native-svg for a full 360° progress.
 * Fetches stats from API when stats prop is not provided.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, StatusColors } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api } from '~/services/api';

const RING_SIZE = 136;
const RING_STROKE = 12;
const HALF = RING_SIZE / 2;
const RADIUS = HALF - RING_STROKE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function getRingColor(percentage: number): string {
  if (percentage >= 90) return StatusColors.checkedIn; // green
  if (percentage >= 70) return StatusColors.pending; // orange
  return StatusColors.missing; // red
}

export type AttendanceStats = {
  total_assigned: number;
  checked_in: number;
  missed: number;
  attendance_percentage: number;
  office_checkins_last_30?: number;
  expected_office_weekdays?: number;
  pull_up_percentage?: number;
};

type Props = {
  /** If provided, use this data; otherwise fetch from API. */
  stats?: AttendanceStats | null;
  /** When true, show a subtle pulse when percentage > 95% */
  enablePulse?: boolean;
  /** Callback when stats are refreshed (e.g. so parent can pass updated stats next time). */
  onStatsLoaded?: (stats: AttendanceStats) => void;
  /** When this value changes (e.g. after office check-in), stats are refetched so Office count updates. */
  refreshTrigger?: string | null;
};

export function CrewAttendanceStatistic({ stats: statsProp, enablePulse = true, onStatsLoaded, refreshTrigger }: Props) {
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

  const total = stats?.total_assigned ?? 0;
  const checkedIn = stats?.checked_in ?? 0;
  const missed = stats?.missed ?? 0;
  const officeCheckins = stats?.office_checkins_last_30 ?? 0;
  const expectedOfficeDays = stats?.expected_office_weekdays ?? 0;
  const pullUpPct = stats?.pull_up_percentage ?? (total === 0 ? 100 : (stats?.attendance_percentage ?? 100));
  const percentage = pullUpPct;
  const ringColor = getRingColor(percentage);
  const progress = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    progress.value = withDelay(
      200,
      withTiming(percentage / 100, { duration: 900, easing: Easing.out(Easing.cubic) })
    );
  }, [percentage]);

  useEffect(() => {
    if (enablePulse && percentage >= 95) {
      pulseScale.value = withDelay(
        1200,
        withRepeat(
          withSequence(
            withTiming(1.02, { duration: 800, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
          ),
          3,
          true
        )
      );
    }
  }, [enablePulse, percentage]);

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const centerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.ringContainer}>
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
            animatedProps={animatedCircleProps}
          />
        </Svg>
        {/* Center content */}
        <Animated.View style={[styles.center, centerAnimatedStyle]} pointerEvents="none">
          <ThemedText style={[styles.percent, { color: colors.text }]}>
            {Math.round(percentage)}%
          </ThemedText>
          <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Pull Up Rate</ThemedText>
        </Animated.View>
      </View>

      <ThemedText style={[styles.subtext, { color: colors.textSecondary }]}>
        {loading && stats == null
          ? 'Loading…'
          : total === 0 && officeCheckins === 0
            ? 'No event days or office days yet'
            : `Event days: ${checkedIn}/${total} checked in · Office (Mon–Fri): ${expectedOfficeDays ? `${officeCheckins}/${expectedOfficeDays}` : officeCheckins}`}
      </ThemedText>

      <View style={styles.badges}>
        <View style={[styles.badge, { backgroundColor: StatusColors.checkedIn + '18', borderColor: StatusColors.checkedIn + '40' }]}>
          <Ionicons name="checkmark-circle" size={14} color={StatusColors.checkedIn} />
          <ThemedText style={[styles.badgeText, { color: colors.text }]}>Events: {checkedIn}/{total}</ThemedText>
        </View>
        <View style={[styles.badge, { backgroundColor: StatusColors.missing + '18', borderColor: StatusColors.missing + '40' }]}>
          <Ionicons name="close-circle" size={14} color={StatusColors.missing} />
          <ThemedText style={[styles.badgeText, { color: colors.text }]}>Missed: {missed}</ThemedText>
        </View>
        <View style={[styles.badge, { backgroundColor: StatusColors.checkedIn + '18', borderColor: StatusColors.checkedIn + '40' }]}>
          <Ionicons name="business" size={14} color={StatusColors.checkedIn} />
          <ThemedText style={[styles.badgeText, { color: colors.text }]}>
            Office: {expectedOfficeDays ? `${officeCheckins}/${expectedOfficeDays}` : officeCheckins}
          </ThemedText>
        </View>
      </View>
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
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  svgRing: {
    position: 'absolute',
  },
  center: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  subtext: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
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
    fontSize: 12,
    fontWeight: '600',
  },
});
