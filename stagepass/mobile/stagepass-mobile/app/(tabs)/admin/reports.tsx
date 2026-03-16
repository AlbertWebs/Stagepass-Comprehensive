/**
 * Reports hub – categories: Events, Crew, Payments, Tasks, Financials.
 * Each opens the report builder for that type.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { NAV_PRESSED_OPACITY, useNavigationPress } from '@/src/utils/navigationPress';
import type { ReportType } from '~/services/api';

const U = { sm: 8, md: 12, lg: 16, xl: 20 };

const CATEGORIES: { type: ReportType; label: string; icon: keyof typeof Ionicons.glyphMap; subtitle: string }[] = [
  { type: 'events', label: 'Events', icon: 'calendar', subtitle: 'Created, completed, upcoming' },
  { type: 'crew-attendance', label: 'Crew attendance', icon: 'people', subtitle: 'Check-ins, missed, participation' },
  { type: 'crew-payments', label: 'Crew payments', icon: 'card', subtitle: 'Pending, completed, totals' },
  { type: 'tasks', label: 'Tasks', icon: 'checkbox', subtitle: 'Assigned, completed, pending' },
  { type: 'financial', label: 'Financials', icon: 'wallet', subtitle: 'Client/event summaries' },
];

export default function AdminReportsHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useStagePassTheme();
  const handleNav = useNavigationPress();
  const cardBg = isDark ? '#1E212A' : '#F5F7FC';
  const iconColor = isDark ? themeYellow : themeBlue;

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Reports" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          Choose a report category, set filters, and generate a report. Export to PDF via Print.
        </ThemedText>
        <View style={styles.grid}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.type}
              onPress={() => handleNav(() => router.push({ pathname: '/admin/reports/[type]', params: { type: cat.type } }))}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: cardBg, borderColor: colors.border, opacity: pressed ? NAV_PRESSED_OPACITY : 1 },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: (isDark ? themeYellow : themeBlue) + '22' }]}>
                <Ionicons name={cat.icon} size={28} color={iconColor} />
              </View>
              <View style={styles.cardText}>
                <ThemedText style={[styles.cardTitle, { color: colors.text }]}>{cat.label}</ThemedText>
                <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]} numberOfLines={2}>
                  {cat.subtitle}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={iconColor} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingTop: Spacing.md },
  subtitle: {
    fontSize: 14,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  grid: { gap: U.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: U.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: U.lg,
  },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  cardSub: { fontSize: 12, marginTop: 2 },
});
