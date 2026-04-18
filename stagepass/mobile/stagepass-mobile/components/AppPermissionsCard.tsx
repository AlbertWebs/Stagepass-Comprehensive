import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import type { AppPermissionRow, PermissionKind } from '~/hooks/useAppPermissionsStatus';

function statusLabel(kind: PermissionKind): string {
  switch (kind) {
    case 'granted':
      return 'Granted';
    case 'denied':
      return 'Denied';
    case 'limited':
      return 'Limited';
    case 'undetermined':
      return 'Not set';
    case 'unavailable':
    default:
      return 'N/A';
  }
}

function statusColor(kind: PermissionKind, colors: { success: string; error: string; textSecondary: string; tint: string }): string {
  switch (kind) {
    case 'granted':
      return colors.success;
    case 'denied':
      return colors.error;
    case 'limited':
      return colors.tint;
    case 'undetermined':
      return colors.textSecondary;
    default:
      return colors.textSecondary;
  }
}

function PermissionRow({
  row,
  cardBorder,
}: {
  row: AppPermissionRow;
  cardBorder: string;
}) {
  const { colors } = useStagePassTheme();
  const c = statusColor(row.status, colors);

  return (
    <View style={[styles.row, { borderTopColor: cardBorder }]}>
      <View style={styles.rowIcon}>
        <Ionicons
          name={
            row.id === 'location'
              ? 'location-outline'
              : row.id === 'notifications'
                ? 'notifications-outline'
                : row.id === 'camera'
                  ? 'camera-outline'
                  : 'images-outline'
          }
          size={22}
          color={colors.textSecondary}
        />
      </View>
      <View style={styles.rowText}>
        <ThemedText style={[styles.rowTitle, { color: colors.text }]}>{row.title}</ThemedText>
        <ThemedText style={[styles.rowSub, { color: colors.textSecondary }]}>{row.subtitle}</ThemedText>
      </View>
      <View style={[styles.badge, { borderColor: c + '66', backgroundColor: c + '18' }]}>
        <ThemedText style={[styles.badgeText, { color: c }]}>{statusLabel(row.status)}</ThemedText>
      </View>
    </View>
  );
}

type AppPermissionsCardProps = {
  rows: AppPermissionRow[];
  hint: string | null;
};

export function AppPermissionsCard({ rows, hint }: AppPermissionsCardProps) {
  const { colors, isDark } = useStagePassTheme();

  const cardBg = colors.surface;
  const cardBorder = isDark ? themeYellow + '44' : themeBlue + '22';
  const accent = themeYellow;

  const openSettings = useCallback(() => {
    if (Platform.OS === 'web') return;
    void Linking.openSettings();
  }, []);

  return (
    <View style={[styles.card, styles.cardVibrant, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={[styles.cardAccent, { backgroundColor: accent }]} />
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionTitleAccent, { backgroundColor: accent }]} />
        <View style={[styles.iconWrap, { backgroundColor: themeYellow + '22', borderColor: themeYellow + '66' }]}>
          <Ionicons name="phone-portrait-outline" size={22} color={themeYellow} />
        </View>
        <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>App permissions</ThemedText>
      </View>
      <ThemedText style={[styles.intro, { color: colors.textSecondary }]}>
        Features on this device and whether the system has allowed them.
      </ThemedText>
      {hint ? (
        <View style={[styles.hintBanner, { backgroundColor: colors.tint + '14', borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.tint} />
          <ThemedText style={[styles.hintText, { color: colors.textSecondary }]}>{hint}</ThemedText>
        </View>
      ) : null}
      {rows.length === 0 ? (
        <ActivityIndicator style={styles.loader} color={themeYellow} />
      ) : (
        rows.map((row) => <PermissionRow key={row.id} row={row} cardBorder={cardBorder} />)
      )}
      {Platform.OS !== 'web' ? (
        <Pressable
          onPress={openSettings}
          style={({ pressed }) => [styles.settingsLink, { opacity: pressed ? 0.75 : 1 }]}
        >
          <Ionicons name="open-outline" size={18} color={colors.tint} />
          <ThemedText style={[styles.settingsLinkText, { color: colors.tint }]}>
            Open system settings
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  cardVibrant: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: BorderRadius.xl,
    borderBottomLeftRadius: BorderRadius.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionTitleAccent: { width: 3, height: 16, borderRadius: 0 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', flex: 1 },
  intro: { fontSize: 13, lineHeight: 19, marginBottom: Spacing.md },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  hintText: { flex: 1, fontSize: 13, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  rowIcon: { width: 28, alignItems: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12, marginTop: 2 },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  loader: { paddingVertical: Spacing.lg },
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  settingsLinkText: { fontSize: 15, fontWeight: '700' },
});
