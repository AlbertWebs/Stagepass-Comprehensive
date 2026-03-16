/**
 * Uniform app header: title on the left, optional back, chat + logout on the right (compact).
 * Use everywhere for a consistent look across tabs and admin/stack screens.
 */
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDispatch } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from '@/components/themed-text';
import { Icons, Typography } from '@/constants/ui';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { NAV_PRESSED_OPACITY } from '@/src/utils/navigationPress';
import { useNavigationPress } from '@/src/utils/navigationPress';
import { useAppRole } from '~/hooks/useAppRole';
import { api } from '~/services/api';
import { logout } from '~/store/authSlice';
import { clearStoredToken } from '~/store/persistAuth';

const SUPPORT_WHATSAPP = process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? '';
const ICON_BTN_SIZE = 36;
const ACCENT_HEIGHT = 2.5;

const ADMIN_MORE_LINKS: { label: string; href: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Events', href: '/admin/events', icon: 'calendar-outline' },
  { label: 'User & crew', href: '/admin/users', icon: 'people-outline' },
  { label: 'Equipment', href: '/admin/equipment', icon: 'cube-outline' },
  { label: 'Communication', href: '/admin/communications', icon: 'chatbubbles-outline' },
  { label: 'Time off', href: '/admin/timeoff', icon: 'time-outline' },
  { label: 'Settings', href: '/admin/settings', icon: 'settings-outline' },
];

const ROUTE_TITLES: Record<string, string> = {
  '': 'Home', '/': 'Home', '/(tabs)': 'Home', '/(tabs)/': 'Home', '/(tabs)/index': 'Home',
  '/(tabs)/events': 'My Events', '/(tabs)/activity': 'Activities', '/(tabs)/profile': 'Profile',
  '/(tabs)/everything': 'Everything', '/(tabs)/allowances': 'Allowances',
  '/(tabs)/recent-activity': 'Recent activity', '/(tabs)/quick-actions': 'Quick actions',
  '/(tabs)/tasks': 'Tasks',
  events: 'My Events', activity: 'Activities', profile: 'Profile',
  everything: 'Everything', allowances: 'Allowances', 'recent-activity': 'Recent activity', 'quick-actions': 'Quick actions', tasks: 'Tasks',
};
const SEGMENT_TITLES: Record<string, string> = {
  index: 'Home', events: 'My Events', activity: 'Activities', profile: 'Profile',
  everything: 'Everything', allowances: 'Allowances', 'recent-activity': 'Recent activity', 'quick-actions': 'Quick actions', tasks: 'Tasks',
};
const ADMIN_SEGMENT_TITLES: Record<string, string> = {
  users: 'Users & Crew', events: 'Events', equipment: 'Equipment', clients: 'Clients',
  reports: 'Reports', payments: 'Payments', timeoff: 'Time Off', communications: 'Communication',
  settings: 'System settings', audit: 'Audit logs', create: 'Create event', edit: 'Edit event',
  crew: 'Crew', operations: 'Operations', more: 'More', checklists: 'Checklists',
  'manage-checkin': 'Manage check-in', message: 'Message crew', 'create-task': 'Create task', checklist: 'Checklist',
};

function getTitleFromPath(pathname: string): string {
  const raw = (pathname || '').trim();
  const normalized = raw.replace(/\/$/, '') || '/';
  const noLeading = normalized.replace(/^\//, '');
  // Paths may be like "(tabs)/admin/users/123" – normalize to check admin/events segments
  const pathForAdmin = noLeading.replace(/^\(tabs\)\/?/, '');
  if (ROUTE_TITLES[normalized]) return ROUTE_TITLES[normalized];
  if (ROUTE_TITLES[noLeading]) return ROUTE_TITLES[noLeading];
  const segment = noLeading.split('/').filter(Boolean).pop() || 'index';
  if (SEGMENT_TITLES[segment]) return SEGMENT_TITLES[segment];
  if ((normalized.includes('/events/') || pathForAdmin.startsWith('events/')) && !normalized.includes('/admin/') && !pathForAdmin.startsWith('admin/')) return 'Event details';
  if (normalized.startsWith('/admin/') || pathForAdmin.startsWith('admin/')) {
    const parts = pathForAdmin.replace(/^admin\/?/, '').split('/');
    const first = parts[0] || '';
    const second = parts[1];
    const third = parts[2];
    if (first === 'users' && second && /^\d+$/.test(second)) return 'Crew details';
    if (first === 'events' && !second) return 'Events';
    if (first === 'events' && second === 'create') return 'Create event';
    if (first === 'events' && second && /^\d+$/.test(second) && third === 'edit') return 'Edit event';
    if (first === 'events' && second && /^\d+$/.test(second) && third === 'crew') return 'Crew';
    if (first === 'events' && second && /^\d+$/.test(second) && third === 'operations') return 'Operations';
    if (first === 'events' && second && /^\d+$/.test(second) && third === 'manage-checkin') return 'Manage check-in';
    if (first === 'events' && second && /^\d+$/.test(second) && third === 'message') return 'Message crew';
    if (first === 'events' && second && /^\d+$/.test(second) && third === 'create-task') return 'Create task';
    if (first === 'events' && second && /^\d+$/.test(second) && third === 'checklist') return 'Checklist';
    if (second === 'create') return ADMIN_SEGMENT_TITLES.create ?? 'Create event';
    if (second === 'edit') return ADMIN_SEGMENT_TITLES.edit ?? 'Edit event';
    if (second === 'crew') return ADMIN_SEGMENT_TITLES.crew ?? 'Crew';
    if (second === 'operations') return ADMIN_SEGMENT_TITLES.operations ?? 'Operations';
    if (first === 'timeoff') return 'Request time off';
    if (first === 'reports' && second) return 'Report';
    return ADMIN_SEGMENT_TITLES[first] ?? (first ? first.charAt(0).toUpperCase() + first.slice(1) : 'Admin');
  }
  return 'Stagepass';
}

export interface HomeHeaderProps {
  /** Page title on the left. Default from route or "Home". */
  title?: string;
  /** Show back button (e.g. stack screens). */
  showBack?: boolean;
  /** Custom back when there is no history (e.g. replace to list). */
  onBack?: () => void;
  /** When set, show notification bell in header (e.g. home screen). */
  notificationCount?: number;
}

export function HomeHeader({ title, showBack, onBack, notificationCount }: HomeHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const role = useAppRole();
  const { colors, isDark } = useStagePassTheme();
  const paddingTop = Math.max(insets.top, Spacing.sm);
  const displayTitle = title ?? (getTitleFromPath(pathname) || 'Home');
  const chatOutlineColor = isDark ? themeYellow : themeBlue;
  const chatIconColor = themeYellow;
  const isAdmin = role === 'admin' || role === 'team_leader';
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const handleNav = useNavigationPress();

  const toggleMoreMenu = useCallback(() => setMoreMenuOpen((v) => !v), []);
  const closeMoreMenu = useCallback(() => setMoreMenuOpen(false), []);

  const handleLogout = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await api.auth.logout();
          } catch {
            // ignore
          }
          await clearStoredToken();
          dispatch(logout());
          router.replace('/login');
          setSigningOut(false);
        },
      },
    ]);
  }, [dispatch, router]);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [onBack, router]);

  const handleSupportPress = async () => {
    const raw = SUPPORT_WHATSAPP.trim();
    if (!raw) {
      Alert.alert('Support unavailable', 'Support WhatsApp number is not configured yet.');
      return;
    }
    const phone = raw.replace(/[^+\d]/g, '');
    const waUrl = `whatsapp://send?phone=${phone}`;
    const webUrl = `https://wa.me/${encodeURIComponent(phone)}`;
    try {
      const canOpen = await Linking.canOpenURL(waUrl);
      if (canOpen) {
        await Linking.openURL(waUrl);
        return;
      }
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert('Cannot open WhatsApp', 'Please check WhatsApp is installed or try again later.');
    }
  };

  const headerBg = isDark ? colors.surface : colors.surface;
  const iconTint = isDark ? themeYellow + '28' : themeBlue + '14';
  const iconBorder = isDark ? themeYellow + '40' : themeBlue + '25';

  return (
    <View style={[styles.outer, { paddingTop, backgroundColor: headerBg }]}>
      <Modal visible={signingOut} transparent animationType="fade" statusBarTranslucent>
        <View style={[styles.logoutOverlay, { backgroundColor: colors.background + 'EE' }]}>
          <ActivityIndicator size="large" color={themeYellow} />
          <ThemedText style={[styles.logoutOverlayText, { color: colors.text }]}>Signing out…</ThemedText>
        </View>
      </Modal>
      <View style={[styles.bar, { borderBottomColor: colors.border }]}>
        {showBack ? (
          <>
            <View style={styles.headerRow}>
              <Pressable
                onPress={handleBack}
                style={({ pressed }) => [styles.backBtn, { backgroundColor: iconTint, borderColor: iconBorder }, pressed && styles.iconBtnPressed]}
                accessibilityLabel="Go back"
                accessibilityRole="button"
              >
                <Ionicons name="chevron-back" size={Icons.header} color={isDark ? themeYellow : themeBlue} />
              </Pressable>
              <View style={[styles.titleWrap, styles.titleWrapFull]}>
                <View style={[styles.titleCap, { backgroundColor: isDark ? themeYellow : themeBlue }]} />
                <ThemedText
                  type="titleLarge"
                  style={[styles.title, { color: isDark ? themeYellow : themeBlue }]}
                  numberOfLines={1}
                >
                  {displayTitle}
                </ThemedText>
              </View>
            </View>
            <View style={[styles.navRow, { borderTopColor: colors.border }]}>
              <Pressable
                onPress={() => {
                  handleNav(() => {
                    const p = (pathname || '').replace(/\/$/, '');
                    if (p.includes('/admin/users')) router.push('/(tabs)/admin/users');
                    else if (p.includes('/admin/events')) router.push('/(tabs)/admin/events');
                    else router.push('/(tabs)/events');
                  });
                }}
                style={({ pressed }) => [styles.breadcrumbWrap, pressed && { opacity: NAV_PRESSED_OPACITY }]}
              >
                <ThemedText style={[styles.breadcrumb, { color: colors.textSecondary }]}>
                  {(() => {
                    const p = (pathname || '').replace(/\/$/, '');
                    if (p.includes('/admin/users')) return 'Users & Crew';
                    if (p.includes('/admin/events')) return 'Projects';
                    return 'My Events';
                  })()}
                </ThemedText>
              </Pressable>
              <View style={styles.rightRow}>
                {typeof notificationCount === 'number' && (
                  <Pressable
                    onPress={() => handleNav(() => router.push('/(tabs)/activity'))}
                    style={({ pressed }) => [styles.iconBtn, styles.bellWrap, { backgroundColor: iconTint, borderColor: iconBorder }, pressed && styles.iconBtnPressed]}
                    accessibilityLabel="Notifications"
                    accessibilityRole="button"
                  >
                    <Ionicons name="notifications-outline" size={Icons.header} color={chatIconColor} />
                    {notificationCount > 0 && (
                      <View style={[styles.bellBadge, { backgroundColor: themeYellow }]}>
                        <ThemedText style={styles.bellBadgeText} numberOfLines={1}>
                          {notificationCount > 99 ? '99+' : notificationCount}
                        </ThemedText>
                      </View>
                    )}
                  </Pressable>
                )}
                {isAdmin ? (
                  <Pressable
                    onPress={toggleMoreMenu}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      { backgroundColor: iconTint, borderColor: moreMenuOpen ? themeYellow : iconBorder },
                      pressed && styles.iconBtnPressed,
                      moreMenuOpen && (isDark ? { backgroundColor: themeYellow + '28' } : { backgroundColor: themeBlue + '18' }),
                    ]}
                    accessibilityLabel="More (admin)"
                    accessibilityState={{ expanded: moreMenuOpen }}
                  >
                    <Ionicons name="apps-outline" size={Icons.header} color={chatIconColor} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={handleSupportPress}
                  style={({ pressed }) => [styles.iconBtn, { backgroundColor: iconTint, borderColor: iconBorder }, pressed && styles.iconBtnPressed]}
                  accessibilityLabel="Chat support"
                >
                  <Ionicons name="chatbubbles-outline" size={Icons.header} color={chatIconColor} />
                </Pressable>
                <Pressable
                  onPress={handleLogout}
                  style={({ pressed }) => [styles.iconBtn, styles.logoutBtn, { backgroundColor: isDark ? themeYellow + '20' : themeBlue + '12', borderColor: isDark ? themeYellow + '50' : themeBlue + '35' }, pressed && styles.iconBtnPressed]}
                  accessibilityLabel="Sign out"
                >
                  <Ionicons name="log-out-outline" size={Icons.header} color={themeYellow} />
                </Pressable>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.barRow}>
            <View style={styles.titleWrap}>
              <View style={[styles.titleCap, { backgroundColor: isDark ? themeYellow : themeBlue }]} />
              <ThemedText type="titleLarge" style={[styles.title, { color: isDark ? themeYellow : themeBlue }]} numberOfLines={1}>
                {displayTitle}
              </ThemedText>
            </View>
            <View style={styles.rightRow}>
              {typeof notificationCount === 'number' && (
                <Pressable
                  onPress={() => handleNav(() => router.push('/(tabs)/activity'))}
                  style={({ pressed }) => [styles.iconBtn, styles.bellWrap, { backgroundColor: iconTint, borderColor: iconBorder }, pressed && styles.iconBtnPressed]}
                  accessibilityLabel="Notifications"
                  accessibilityRole="button"
                >
                  <Ionicons name="notifications-outline" size={Icons.header} color={chatIconColor} />
                  {notificationCount > 0 && (
                    <View style={[styles.bellBadge, { backgroundColor: themeYellow }]}>
                      <ThemedText style={styles.bellBadgeText} numberOfLines={1}>
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </ThemedText>
                    </View>
                  )}
                </Pressable>
              )}
              {isAdmin ? (
                <Pressable
                  onPress={toggleMoreMenu}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    { backgroundColor: iconTint, borderColor: moreMenuOpen ? themeYellow : iconBorder },
                    pressed && styles.iconBtnPressed,
                    moreMenuOpen && (isDark ? { backgroundColor: themeYellow + '28' } : { backgroundColor: themeBlue + '18' }),
                  ]}
                  accessibilityLabel="More (admin)"
                  accessibilityState={{ expanded: moreMenuOpen }}
                >
                  <Ionicons name="apps-outline" size={Icons.header} color={chatIconColor} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={handleSupportPress}
                style={({ pressed }) => [styles.iconBtn, { backgroundColor: iconTint, borderColor: iconBorder }, pressed && styles.iconBtnPressed]}
                accessibilityLabel="Chat support"
              >
                <Ionicons name="chatbubbles-outline" size={Icons.header} color={chatIconColor} />
              </Pressable>
              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [styles.iconBtn, styles.logoutBtn, { backgroundColor: isDark ? themeYellow + '20' : themeBlue + '12', borderColor: isDark ? themeYellow + '50' : themeBlue + '35' }, pressed && styles.iconBtnPressed]}
                accessibilityLabel="Sign out"
              >
                <Ionicons name="log-out-outline" size={Icons.header} color={themeYellow} />
              </Pressable>
            </View>
          </View>
        )}
      </View>
      <LinearGradient
        colors={[themeYellow, themeYellow, isDark ? themeYellow : themeBlue, isDark ? themeYellow : themeBlue]}
        locations={[0, 0.5, 0.52, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accent}
      />

      {isAdmin && moreMenuOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={closeMoreMenu}>
          <Pressable style={styles.moreOverlay} onPress={closeMoreMenu}>
            <Pressable style={[styles.moreDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
              {ADMIN_MORE_LINKS.map((item, index) => (
                <Pressable
                  key={item.href}
                  onPress={() => {
                    closeMoreMenu();
                    handleNav(() => router.push(item.href as any));
                  }}
                  style={({ pressed }) => [
                    styles.moreItem,
                    index < ADMIN_MORE_LINKS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                    pressed && { opacity: NAV_PRESSED_OPACITY },
                  ]}
                >
                  <Ionicons name={item.icon} size={Icons.standard} color={themeYellow} />
                  <ThemedText type="body" style={[styles.moreItemLabel, { color: colors.text }]}>{item.label}</ThemedText>
                  <Ionicons name="chevron-forward" size={Icons.medium} color={colors.textSecondary} />
                </Pressable>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 0,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  bar: {
    paddingVertical: Spacing.sm + 2,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm + 2,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  breadcrumbWrap: {
    paddingVertical: 2,
    paddingRight: Spacing.sm,
  },
  breadcrumb: {
    fontSize: Typography.label,
    fontWeight: Typography.labelWeight,
    letterSpacing: 0.3,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  titleWrapFull: {
    marginRight: 0,
  },
  backBtn: {
    width: ICON_BTN_SIZE,
    height: ICON_BTN_SIZE,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm + 2,
    borderWidth: 1,
    overflow: 'hidden',
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.sm + 2,
    minWidth: 0,
  },
  titleCap: {
    width: 2,
    height: 18,
    borderRadius: 1,
    marginRight: Spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: Typography.titleLarge,
    fontWeight: Typography.titleLargeWeight,
    letterSpacing: 0.35,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBtn: {
    width: ICON_BTN_SIZE,
    height: ICON_BTN_SIZE,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  logoutBtn: {},
  iconBtnPressed: {
    opacity: NAV_PRESSED_OPACITY,
  },
  bellWrap: {
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: themeBlue,
  },
  accent: {
    height: ACCENT_HEIGHT,
    marginHorizontal: 0,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
  },
  moreOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingTop: 60,
    paddingRight: Spacing.lg,
    alignItems: 'flex-end',
  },
  logoutOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  logoutOverlayText: {
    fontSize: Typography.body,
    fontWeight: Typography.bodyBoldWeight,
  },
  moreDropdown: {
    minWidth: 228,
    maxWidth: 280,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: Spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  moreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  moreItemLabel: {
    flex: 1,
    fontSize: Typography.buttonText,
    fontWeight: Typography.buttonTextWeight,
    letterSpacing: 0.2,
  },
});
