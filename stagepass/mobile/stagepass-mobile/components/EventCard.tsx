/**
 * Event card – scheduling-style: title, location, date/time, status pill, View + Edit buttons.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, StatusColors, themeBlue, themeYellow, VibrantColors } from '@/constants/theme';
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

/** For My Events: show Created | Checked in | Checked out | Completed with standard colors */
export type EventDisplayStatus = 'created' | 'checked_in' | 'checked_out' | 'completed';

const DISPLAY_STATUS_LABEL: Record<EventDisplayStatus, string> = {
  created: 'Created',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  completed: 'Completed',
};

const DISPLAY_STATUS_BG: Record<EventDisplayStatus, string> = {
  created: VibrantColors.amber,
  checked_in: StatusColors.checkedIn,
  checked_out: VibrantColors.sky,
  completed: VibrantColors.teal,
};

type EventCardProps = {
  event: EventCardEvent;
  onPress: () => void;
  onEdit?: () => void;
  /** Optional: for My Events, use this to show Created/Checked in/Checked out/Completed with standard colors */
  displayStatus?: EventDisplayStatus;
  /** Optional extra action buttons (e.g. Crew, Operations) shown in same row as View */
  extraActions?: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }[];
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
  try {
    const [sh, sm] = start.slice(0, 5).split(':');
    const h = parseInt(sh, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const startStr = `${h12}:${sm || '00'} ${ampm}`;
    if (!end) return startStr;
    const [eh, em] = end.slice(0, 5).split(':');
    const ehNum = parseInt(eh, 10);
    const eampm = ehNum >= 12 ? 'PM' : 'AM';
    const eh12 = ehNum % 12 || 12;
    return `${startStr} – ${eh12}:${em || '00'} ${eampm}`;
  } catch {
    const s = start.slice(0, 5);
    return end ? `${s} – ${end.slice(0, 5)}` : s;
  }
}

function statusDisplay(status: string): string {
  const s = (status || 'Scheduled').trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function EventCard({ event, onPress, onEdit, extraActions, displayStatus }: EventCardProps) {
  const { colors } = useStagePassTheme();
  const timeRange = formatTimeRange(event.start_time, event.expected_end_time);
  const useDisplayStatus = displayStatus != null;
  const statusLabel = useDisplayStatus ? DISPLAY_STATUS_LABEL[displayStatus] : statusDisplay(event.status);
  const statusBg = useDisplayStatus ? DISPLAY_STATUS_BG[displayStatus] : themeYellow;
  const accentColor = useDisplayStatus ? DISPLAY_STATUS_BG[displayStatus] : VibrantColors.emerald;

  return (
    <View style={[styles.cardWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
      <View style={styles.cardInner}>
        <View style={styles.topRow}>
          <ThemedText style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {event.name}
          </ThemedText>
          <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
            <ThemedText style={styles.statusText} numberOfLines={1}>
              {statusLabel}
            </ThemedText>
          </View>
        </View>
        {event.location_name ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={VibrantColors.emerald} style={styles.locationIcon} />
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
        <View style={[styles.actionsWrap, { borderTopColor: colors.border }]}>
          <View style={styles.actions}>
          <Pressable
            onPress={onPress}
            style={({ pressed }) => [
              styles.primaryBtn,
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <ThemedText style={styles.primaryBtnText}>
              {useDisplayStatus && displayStatus === 'created' ? 'Check-In Options' : 'Event Details'}
            </ThemedText>
          </Pressable>
          {extraActions?.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              style={({ pressed }) => [styles.extraAction, { opacity: pressed ? 0.8 : 1 }]}
            >
              {action.icon ? (
                <Ionicons name={action.icon} size={16} color={colors.brandIcon} style={styles.extraActionIcon} />
              ) : null}
              <ThemedText style={[styles.extraActionText, { color: colors.brandText }]}>{action.label}</ThemedText>
            </Pressable>
          ))}
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
    </View>
  );
}

const CARD_RADIUS = 12;
const U = { xs: 6, sm: 8, md: 12, lg: 14 };

const styles = StyleSheet.create({
  cardWrap: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    marginBottom: U.md,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  cardAccent: {
    width: 4,
    borderTopLeftRadius: CARD_RADIUS,
    borderBottomLeftRadius: CARD_RADIUS,
  },
  cardInner: {
    flex: 1,
    padding: U.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: U.sm,
    marginBottom: U.xs,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  statusPill: {
    paddingHorizontal: U.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'capitalize',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: U.xs,
  },
  locationIcon: {
    marginRight: 4,
  },
  location: {
    flex: 1,
    fontSize: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: U.sm,
  },
  timeText: {
    fontSize: 12,
  },
  actionsWrap: {
    marginTop: U.sm,
    paddingTop: U.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: U.md,
    flexWrap: 'wrap',
  },
  extraAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: U.xs,
    paddingHorizontal: U.sm,
  },
  extraActionIcon: { marginRight: 4 },
  extraActionText: { fontSize: 13, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: themeYellow,
    paddingVertical: U.sm,
    paddingHorizontal: U.lg,
    borderRadius: CARD_RADIUS,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: themeBlue,
  },
  secondaryBtn: {
    paddingVertical: U.xs,
    paddingHorizontal: U.sm,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
