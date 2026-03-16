/**
 * Admin More: Events, User & crew, Equipment, Communication, Time off, Settings.
 * Other admin features (tasks, clients, payments, reports, audit, etc.) are in the web admin.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { Pressable } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { NAV_PRESSED_OPACITY, useNavigationPress } from '@/src/utils/navigationPress';

const LINKS = [
  { label: 'Events', icon: 'calendar-outline' as const, href: '/admin/events' },
  { label: 'User & crew', icon: 'people-outline' as const, href: '/admin/users' },
  { label: 'Equipment', icon: 'cube-outline' as const, href: '/admin/equipment' },
  { label: 'Communication', icon: 'chatbubbles-outline' as const, href: '/admin/communications' },
  { label: 'Time off', icon: 'time-outline' as const, href: '/admin/timeoff' },
  { label: 'Settings', icon: 'settings-outline' as const, href: '/admin/settings' },
];

export default function AdminMoreScreen() {
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const handleNav = useNavigationPress();
  const insets = useSafeAreaInsets();
  const cardBg = colors.surface;
  const cardBorder = colors.border;

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="More" />
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>
          Other admin sections
        </ThemedText>
        {LINKS.map((item) => (
          <Pressable
            key={item.href}
            onPress={() => handleNav(() => router.push(item.href as any))}
            style={({ pressed }) => [
              styles.row,
              { borderBottomColor: cardBorder },
              pressed && { opacity: NAV_PRESSED_OPACITY },
            ]}
          >
            <Ionicons name={item.icon} size={22} color={themeYellow} />
            <ThemedText style={[styles.label, { color: colors.text }]}>{item.label}</ThemedText>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        ))}
      </View>
      <View style={{ height: insets.bottom + 80 }} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  cardSub: { fontSize: 13, marginBottom: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { flex: 1, fontSize: 16, fontWeight: '600' },
});
