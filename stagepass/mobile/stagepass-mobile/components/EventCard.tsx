/**
 * Event card – attractive card with date badge, location, status pill, accent strip.
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
  location_name?: string;
  status: string;
};

type EventCardProps = {
  event: EventCardEvent;
  onPress: () => void;
};

function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    return `${month} ${day}`;
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return '';
  try {
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m || '00'} ${ampm}`;
  } catch {
    return timeStr;
  }
}

function statusStyle(status: string): { bg: string; text: string } {
  const s = (status || '').toLowerCase();
  if (s.includes('live') || s === 'active') return { bg: themeYellow + '28', text: themeBlue };
  if (s.includes('complete') || s.includes('done') || s === 'ended')
    return { bg: '#22C55E22', text: '#22C55E' };
  if (s.includes('cancel')) return { bg: '#EF444422', text: '#EF4444' };
  /* Created, Scheduled, default: yellow accent */
  return { bg: themeYellow + '22', text: themeBlue };
}

export function EventCard({ event, onPress }: EventCardProps) {
  const { colors } = useStagePassTheme();
  const statusColors = statusStyle(event.status);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrapper,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={[styles.accent, { backgroundColor: themeBlue }]} />
      <View style={styles.inner}>
        <View style={styles.topRow}>
          <View style={[styles.dateBadge, { backgroundColor: themeBlue }]}>
            <Ionicons name="calendar" size={14} color="#fff" />
            <ThemedText style={styles.dateText}>{formatDateLabel(event.date)}</ThemedText>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColors.bg }]}>
            <ThemedText style={[styles.statusText, { color: statusColors.text }]} numberOfLines={1}>
              {event.status || 'Scheduled'}
            </ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.name, { color: colors.text }]} numberOfLines={2}>
          {event.name}
        </ThemedText>
        {(event.location_name || event.start_time) && (
          <View style={styles.metaRow}>
            {event.location_name ? (
              <View style={styles.metaItem}>
                <Ionicons name="location" size={14} color={colors.textSecondary} />
                <ThemedText style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {event.location_name}
                </ThemedText>
              </View>
            ) : null}
            {event.start_time ? (
              <View style={styles.metaItem}>
                <Ionicons name="time" size={14} color={themeYellow} />
                <ThemedText style={[styles.metaText, { color: colors.textSecondary }]}>
                  {formatTime(event.start_time)}
                </ThemedText>
              </View>
            ) : null}
          </View>
        )}
        <View style={styles.chevron}>
          <Ionicons name="chevron-forward" size={20} color={themeYellow} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  accent: {
    width: 4,
    marginRight: 0,
  },
  inner: {
    flex: 1,
    padding: Spacing.lg,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xxl + 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  statusPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    maxWidth: '50%',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: Spacing.xs,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '80%',
  },
  metaText: {
    fontSize: 13,
  },
  chevron: {
    position: 'absolute',
    right: Spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
