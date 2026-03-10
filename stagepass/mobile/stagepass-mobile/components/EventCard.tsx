/**
 * Event card – scheduling-style: title, location, date/time, status pill, View + Edit buttons.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

export type EventCardEvent = {
  id: number;
  name: string;
  date: string;
  start_time?: string;
  expected_end_time?: string;
  location_name?: string;
  status: string;
};

type EventCardProps = {
  event: EventCardEvent;
  onPress: () => void;
  onEdit?: () => void;
};

function formatDateFull(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatTimeRange(start?: string, end?: string): string {
  if (!start) return '';
  const s = start.slice(0, 5);
  if (end) return `${s} - ${end.slice(0, 5)}`;
  return s;
}

function statusDisplay(status: string): string {
  const s = (status || 'Scheduled').trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function EventCard({ event, onPress, onEdit }: EventCardProps) {
  const { colors } = useStagePassTheme();
  const timeRange = formatTimeRange(event.start_time, event.expected_end_time);

  return (
    <View style={[styles.cardWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.cardAccent, { backgroundColor: themeYellow }]} />
      <View style={styles.cardInner}>
        <View style={styles.topRow}>
          <ThemedText style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {event.name}
          </ThemedText>
          <View style={[styles.statusPill, { backgroundColor: themeYellow }]}>
            <ThemedText style={styles.statusText} numberOfLines={1}>
              {statusDisplay(event.status)}
            </ThemedText>
          </View>
        </View>
        {event.location_name ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={themeYellow} style={styles.locationIcon} />
            <ThemedText style={[styles.location, { color: colors.textSecondary }]} numberOfLines={1}>
              {event.location_name}
            </ThemedText>
          </View>
        ) : null}
        {(event.date || timeRange) ? (
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <ThemedText style={[styles.timeText, { color: colors.textSecondary }]}>
              {formatDateFull(event.date)}
              {timeRange ? ` · ${timeRange}` : ''}
            </ThemedText>
          </View>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            onPress={onPress}
            style={({ pressed }) => [
              styles.primaryBtn,
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <ThemedText style={styles.primaryBtnText}>View</ThemedText>
          </Pressable>
          {onEdit ? (
            <Pressable
              onPress={onEdit}
              style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.8 : 1 }]}
            >
              <ThemedText style={[styles.secondaryBtnText, { color: colors.text }]}>
                Edit
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardAccent: {
    width: 5,
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.lg,
  },
  cardInner: {
    flex: 1,
    padding: Spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  statusPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'capitalize',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  locationIcon: {
    marginRight: 4,
  },
  location: {
    flex: 1,
    fontSize: 13,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.md,
  },
  timeText: {
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  primaryBtn: {
    backgroundColor: themeYellow,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: themeBlue,
  },
  secondaryBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
