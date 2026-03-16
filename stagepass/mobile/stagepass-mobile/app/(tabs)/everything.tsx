/**
 * Everything – hub of all operations in the mobile app (role-based).
 * Squared icon tiles grouped by category; minimal scrolling.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HomeHeader } from '@/components/HomeHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { QUICK_ACTIONS } from '@/constants/quickActions';
import { themeBlue, themeYellow, VibrantColors } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { NAV_PRESSED_OPACITY, useNavigationPress } from '@/src/utils/navigationPress';
import { useAppRole } from '~/hooks/useAppRole';

const U = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, section: 20 };
const CARD_RADIUS = 12;
const TAB_BAR_HEIGHT = 58;

/** Number of columns in the grid (squared tiles). */
const COLS = 3;
const GAP = U.sm;
const PADDING_H = U.lg;

type LinkItem = { label: string; href: string; icon: string };

/** All admin tools. Admin sees all; team_leader sees a subset. */
const ADMIN_TOOLS: LinkItem[] = [
  { label: 'Events', href: '/admin/events', icon: 'calendar-outline' },
  { label: 'Create event', href: '/admin/events/create', icon: 'add-circle' },
  { label: 'Users & crew', href: '/admin/users', icon: 'people-outline' },
  { label: 'Equipment', href: '/admin/equipment', icon: 'cube-outline' },
  { label: 'Communications', href: '/admin/communications', icon: 'chatbubbles-outline' },
  { label: 'Time off', href: '/admin/timeoff', icon: 'time-outline' },
  { label: 'Settings', href: '/admin/settings', icon: 'settings-outline' },
  { label: 'Manage check-in', href: '/admin/manage-checkin', icon: 'location' },
  { label: 'Checklists', href: '/admin/checklists', icon: 'checkbox' },
  { label: 'Reports', href: '/admin/reports', icon: 'bar-chart' },
  { label: 'Payments', href: '/admin/payments', icon: 'card-outline' },
  { label: 'Clients', href: '/admin/clients', icon: 'business-outline' },
  { label: 'Audit logs', href: '/admin/audit', icon: 'document-text-outline' },
];

const ADMIN_ONLY_IDS = new Set(['Create event', 'Users & crew', 'Equipment', 'Communications', 'Settings', 'Reports', 'Payments', 'Clients', 'Audit logs']);

function useTileSize() {
  const { width } = Dimensions.get('window');
  const contentWidth = width - PADDING_H * 2;
  const totalGap = GAP * (COLS - 1);
  const tileSize = (contentWidth - totalGap) / COLS;
  return Math.floor(tileSize);
}

export default function EverythingScreen() {
  const router = useRouter();
  const role = useAppRole();
  const { colors, isDark } = useStagePassTheme();
  const handleNav = useNavigationPress();
  const iconColor = isDark ? themeYellow : themeBlue;
  const cardBg = isDark ? '#1E212A' : '#F5F7FC';
  const tileSize = useTileSize();

  /** Quick actions on Everything: exclude items that appear in other sections to avoid redundancy. */
  const visibleQuickActions = QUICK_ACTIONS.filter((a) => {
    if (a.id === 'everything' || a.id === 'checkin') return false;
    if (a.id === 'events' || a.id === 'activity') return false; // My Events, Activities → in Activity & history
    if (a.id === 'requestoff') return false; // Request off → in Tasks & work only
    if (!a.roles) return true;
    return a.roles.includes(role);
  });

  /** Accent color per section for titles and variety */
  const sectionAccent = (title: string) => {
    if (title === 'Quick actions') return isDark ? themeYellow : themeBlue;
    if (title === 'Activity & history') return VibrantColors.sky;
    if (title === 'Tasks & work') return VibrantColors.emerald;
    return isDark ? themeYellow : themeBlue; // Admin
  };

  const sections: { title: string; links: LinkItem[]; icon?: string }[] = [];

  if (visibleQuickActions.length > 0) {
    sections.push({
      title: 'Quick actions',
      icon: 'flash',
      links: visibleQuickActions.map((a) => ({ label: a.label, href: a.href, icon: a.icon })),
    });
  }

  sections.push(
    {
      title: 'Activity & history',
      icon: 'pulse',
      links: [
        { label: 'Recent activity', href: '/(tabs)/recent-activity', icon: 'pulse' },
        { label: 'Activity feed', href: '/(tabs)/activity', icon: 'notifications' },
        { label: 'My events', href: '/(tabs)/events', icon: 'calendar' },
      ],
    },
  );
  sections.push({
    title: 'Tasks & work',
    icon: 'checkbox',
    links: [
      { label: 'Tasks', href: '/(tabs)/tasks', icon: 'checkbox' },
      ...(role === 'crew' || role === 'team_leader' ? ([
        { label: 'Allowances', href: '/(tabs)/allowances', icon: 'wallet-outline' },
        { label: 'Request time off', href: '/admin/timeoff', icon: 'time-outline' },
      ] as LinkItem[]) : []),
    ],
  });

  if (role === 'admin') {
    sections.push({ title: 'Admin', icon: 'shield-checkmark', links: ADMIN_TOOLS });
  } else if (role === 'team_leader') {
    sections.push({
      title: 'Admin',
      icon: 'shield-checkmark',
      links: ADMIN_TOOLS.filter((t) => {
        if (ADMIN_ONLY_IDS.has(t.label)) return false;
        if (t.label === 'Time off') return false; // team_leader uses "Request off" in Tasks & work
        return true;
      }),
    });
  }

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="Everything" showBack onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_HEIGHT + U.section }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Compact hero */}
        <View style={[styles.hero, { backgroundColor: (isDark ? themeYellow : themeBlue) + '18', borderColor: (isDark ? themeYellow : themeBlue) + '40' }]}>
          <View style={[styles.heroIconWrap, { backgroundColor: (isDark ? themeYellow : themeBlue) + '30' }]}>
            <Ionicons name="apps" size={24} color={iconColor} />
          </View>
          <View style={styles.heroTextWrap}>
            <ThemedText style={[styles.heroTitle, { color: colors.text }]}>Everything</ThemedText>
            <ThemedText style={[styles.heroSub, { color: colors.textSecondary }]}>All features for your role</ThemedText>
          </View>
        </View>

        {sections.map((section) => {
          const accent = sectionAccent(section.title);
          return (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionAccent, { backgroundColor: accent }]} />
              {section.icon ? (
                <View style={[styles.sectionIconWrap, { backgroundColor: accent + '28' }]}>
                  <Ionicons name={section.icon as any} size={14} color={accent} />
                </View>
              ) : null}
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                {section.title}
              </ThemedText>
            </View>
            <View style={styles.grid}>
              {section.links.map((link) => (
                <Pressable
                  key={link.label}
                  onPress={() => handleNav(() => router.push(link.href as any))}
                  style={({ pressed }) => [
                    styles.tile,
                    {
                      width: tileSize,
                      height: tileSize,
                      backgroundColor: cardBg,
                      borderColor: colors.border,
                      opacity: pressed ? NAV_PRESSED_OPACITY : 1,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isDark ? 0.2 : 0.06,
                      shadowRadius: 3,
                      elevation: 2,
                    },
                  ]}
                >
                  <View style={[styles.tileIconWrap, { backgroundColor: (isDark ? themeYellow : themeBlue) + '22' }]}>
                    <Ionicons name={link.icon as any} size={22} color={iconColor} />
                  </View>
                  <ThemedText style={[styles.tileLabel, { color: colors.text }]} numberOfLines={2}>
                    {link.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
          );
        })}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: PADDING_H, paddingTop: U.md },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: U.lg,
    paddingVertical: U.lg,
    paddingHorizontal: U.lg,
    marginBottom: U.section,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: { flex: 1, minWidth: 0 },
  heroTitle: { fontSize: 17, fontWeight: '800', marginBottom: 2 },
  heroSub: { fontSize: 13 },
  section: { marginBottom: U.section },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: U.sm,
    gap: U.sm,
  },
  sectionAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  tile: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    padding: U.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: U.xs,
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 13,
  },
});
