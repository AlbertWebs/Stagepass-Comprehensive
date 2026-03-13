/**
 * Horizontal scrollable date strip – selected day in gold, others in default text.
 * Matches scheduling-style UI (e.g. Mon 9, Tue 10).
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const NUM_DAYS_BACK = 3;
const NUM_DAYS_FORWARD = 21;

function getDays(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: Date[] = [];
  for (let i = -NUM_DAYS_BACK; i <= NUM_DAYS_FORWARD; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}

function dateKey(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export type DateStripProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
};

export function DateStrip({ selectedDate, onSelectDate }: DateStripProps) {
  const { colors } = useStagePassTheme();
  const days = React.useMemo(getDays, []);
  const selectedKey = dateKey(selectedDate);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.scroll}
    >
      {days.map((d) => {
        const key = dateKey(d);
        const isSelected = key === selectedKey;
        const dayLabel = DAY_LABELS[d.getDay()];
        const dateNum = d.getDate();
        return (
          <Pressable
            key={key}
            onPress={() => onSelectDate(d)}
            style={[
              styles.dayChip,
              { borderColor: colors.border, backgroundColor: isSelected ? undefined : colors.surface },
              isSelected && styles.dayChipSelected,
            ]}
          >
            <ThemedText
              style={[
                styles.dayLabel,
                { color: isSelected ? '#fff' : colors.textSecondary },
              ]}
            >
              {dayLabel}
            </ThemedText>
            <ThemedText
              style={[
                styles.dayNum,
                { color: isSelected ? '#fff' : colors.text },
              ]}
            >
              {dateNum}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const U = { sm: 8, md: 12, lg: 14 };
const CHIP_RADIUS = 12;

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -U.lg },
  scrollContent: {
    paddingHorizontal: U.lg,
    paddingVertical: U.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayChip: {
    minWidth: 48,
    marginRight: U.sm,
    paddingVertical: U.sm,
    paddingHorizontal: U.sm,
    borderRadius: CHIP_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipSelected: {
    backgroundColor: themeYellow,
    borderColor: themeYellow,
    shadowColor: themeYellow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  dayNum: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
});
