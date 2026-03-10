/**
 * Admin More: link to Homepage, then Equipment, Clients, Reports, Payments, Time off, Communications, Settings, Audit.
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

const LINKS = [
  { label: 'Homepage', icon: 'home-outline' as const, href: '/(tabs)' },
  { label: 'Equipment', icon: 'cube-outline' as const, href: '/admin/equipment' },
  { label: 'Clients', icon: 'business-outline' as const, href: '/admin/clients' },
  { label: 'Reports', icon: 'bar-chart-outline' as const, href: '/admin/reports' },
  { label: 'Payments', icon: 'card-outline' as const, href: '/admin/payments' },
  { label: 'Time off', icon: 'time-outline' as const, href: '/admin/timeoff' },
  { label: 'Communication', icon: 'chatbubbles-outline' as const, href: '/admin/communications' },
  { label: 'Settings', icon: 'settings-outline' as const, href: '/admin/settings' },
  { label: 'Audit logs', icon: 'document-text-outline' as const, href: '/admin/audit' },
];

export default function AdminMoreScreen() {
  const router = useRouter();
  const { colors } = useStagePassTheme();
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
            onPress={() =>
              item.href === '/(tabs)' ? router.replace('/(tabs)' as any) : router.push(item.href as any)
            }
            style={({ pressed }) => [
              styles.row,
              { borderBottomColor: cardBorder },
              pressed && { opacity: 0.7 },
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
