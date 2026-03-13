/**
 * Uniform app header: title on the left, optional back, chat + logout on the right (compact).
 * Use everywhere for a consistent look across tabs and admin/stack screens.
 */
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDispatch } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { useAppRole } from '~/hooks/useAppRole';
import { api } from '~/services/api';
import { logout } from '~/store/authSlice';
import { clearStoredToken } from '~/store/persistAuth';

const SUPPORT_WHATSAPP = process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? '';
const ICON_SIZE = 17;
const ICON_BTN_SIZE = 36;
const ACCENT_HEIGHT = 4;

const ADMIN_MORE_LINKS: { label: string; href: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Events', href: '/admin/events', icon: 'calendar-outline' },
  { label: 'User & crew', href: '/admin/users', icon: 'people-outline' },
  { label: 'Equipment', href: '/admin/equipment', icon: 'cube-outline' },
  { label: 'Communication', href: '/admin/communications', icon: 'chatbubbles-outline' },
  { label: 'Time off', href: '/admin/timeoff', icon: 'time-outline' },
  { label: 'Settings', href: '/admin/settings', icon: 'settings-outline' },
];

const ROUTE_TITLES: Record<string, string> = {
  '': 'Home', '/': 'Home', '/(tabs)': 'Home', '/(tabs)/': 'Home',
  '/(tabs)/events': 'My Events', '/(tabs)/activity': 'Activities', '/(tabs)/profile': 'Profile',
  events: 'My Events', activity: 'Activities', profile: 'Profile',
};
const SEGMENT_TITLES: Record<string, string> = {
  index: 'Home', events: 'My Events', activity: 'Activities', profile: 'Profile',
};
const ADMIN_SEGMENT_TITLES: Record<string, string> = {
  users: 'Users & Crew', events: 'Events', equipment: 'Equipment', clients: 'Clients',
  reports: 'Reports', payments: 'Payments', timeoff: 'Time Off', communications: 'Communication',
  settings: 'Settings', audit: 'Audit Logs', create: 'Create event', edit: 'Edit event',
  crew: 'Crew', operations: 'Operations',
};

function getTitleFromPath(pathname: string): string {
  const raw = (pathname || '').trim();
  const normalized = raw.replace(/\/$/, '') || '/';
  if (ROUTE_TITLES[normalized]) return ROUTE_TITLES[normalized];
  const noLeading = normalized.replace(/^\//, '');
  if (ROUTE_TITLES[noLeading]) return ROUTE_TITLES[noLeading];
  const segment = noLeading.split('/').filter(Boolean).pop() || 'index';
  if (SEGMENT_TITLES[segment]) return SEGMENT_TITLES[segment];
  if (normalized.startsWith('/events/') && !normalized.includes('/admin/')) return 'Event';
  if (normalized.startsWith('/admin/')) {
    const parts = noLeading.replace(/^admin\/?/, '').split('/');
    const first = parts[0] || '';
    const second = parts[1];
    if (second === 'create') return ADMIN_SEGMENT_TITLES.create ?? 'Create event';
    if (second === 'edit') return ADMIN_SEGMENT_TITLES.edit ?? 'Edit event';
    if (second === 'crew') return ADMIN_SEGMENT_TITLES.crew ?? 'Crew';
    if (second === 'operations') return ADMIN_SEGMENT_TITLES.operations ?? 'Operations';
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

  const toggleMoreMenu = useCallback(() => setMoreMenuOpen((v) => !v), []);
  const closeMoreMenu = useCallback(() => setMoreMenuOpen(false), []);

  const handleLogout = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.auth.logout();
          } catch {
            // ignore
          }
          await clearStoredToken();
          dispatch(logout());
          router.replace('/login');
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

  return (
    <View style={[styles.outer, { paddingTop, backgroundColor: colors.surface }]}>
      <View style={styles.bar}>
        {showBack ? (
          <>
            <View style={styles.headerRow}>
              <Pressable
                onPress={handleBack}
                style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.background }, pressed && styles.iconBtnPressed]}
                accessibilityLabel="Go back"
                accessibilityRole="button"
              >
                <Ionicons name="chevron-back" size={ICON_SIZE} color={colors.text} />
              </Pressable>
              <View style={[styles.titleWrap, styles.titleWrapFull]}>
                <View style={[styles.titleAccentBar, { backgroundColor: themeYellow }]} />
                <ThemedText
                  style={[
                    styles.title,
                    { color: isDark ? themeYellow : themeBlue },
                    isDark && styles.titleShadowDark,
                  ]}
                  numberOfLines={1}
                >
                  {displayTitle}
                </ThemedText>
              </View>
            </View>
            <View style={[styles.navRow, { borderTopColor: colors.border }]}>
              <Pressable onPress={() => router.push('/(tabs)/events')} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <ThemedText style={[styles.breadcrumb, { color: colors.textSecondary }]}>My Events</ThemedText>
              </Pressable>
              <View style={styles.rightRow}>
                {typeof notificationCount === 'number' && (
                  <Pressable
                    onPress={() => router.push('/(tabs)/activity')}
                    style={({ pressed }) => [styles.iconBtn, styles.bellWrap, { backgroundColor: isDark ? themeYellow + '22' : themeBlue + '0c', borderColor: chatOutlineColor }, pressed && styles.iconBtnPressed]}
                    accessibilityLabel="Notifications"
                    accessibilityRole="button"
                  >
                    <Ionicons name="notifications-outline" size={ICON_SIZE} color={chatIconColor} />
                    {notificationCount > 0 && (
                      <View style={styles.bellBadge}>
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
                      { backgroundColor: isDark ? themeYellow + '22' : themeBlue + '0c', borderColor: chatOutlineColor },
                      pressed && styles.iconBtnPressed,
                      moreMenuOpen && { borderColor: themeYellow, backgroundColor: isDark ? themeYellow + '33' : themeBlue + '18' },
                    ]}
                    accessibilityLabel="More (admin)"
                    accessibilityState={{ expanded: moreMenuOpen }}
                  >
                    <Ionicons name="apps-outline" size={ICON_SIZE} color={chatIconColor} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={handleSupportPress}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    { backgroundColor: isDark ? themeYellow + '22' : themeBlue + '0c', borderColor: chatOutlineColor },
                    pressed && styles.iconBtnPressed,
                  ]}
                  accessibilityLabel="Chat support"
                >
                  <Ionicons name="chatbubbles-outline" size={ICON_SIZE} color={chatIconColor} />
                </Pressable>
                <Pressable
                  onPress={handleLogout}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    { backgroundColor: isDark ? themeYellow + '22' : themeBlue + '0c', borderColor: isDark ? themeYellow : themeBlue },
                    pressed && styles.iconBtnPressed,
                  ]}
                  accessibilityLabel="Sign out"
                >
                  <Ionicons name="log-out-outline" size={ICON_SIZE} color={themeYellow} />
                </Pressable>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.barRow}>
            <View style={styles.titleWrap}>
              <View style={[styles.titleAccentBar, { backgroundColor: themeYellow }]} />
              <ThemedText
                style={[
                  styles.title,
                  { color: isDark ? themeYellow : themeBlue },
                  isDark && styles.titleShadowDark,
                ]}
                numberOfLines={1}
              >
                {displayTitle}
              </ThemedText>
            </View>
<View style={styles.rightRow}>
              {typeof notificationCount === 'number' && (
                <Pressable
                  onPress={() => router.push('/(tabs)/activity')}
                  style={({ pressed }) => [styles.iconBtn, styles.bellWrap, { backgroundColor: isDark ? themeYellow + '22' : themeBlue + '0c', borderColor: chatOutlineColor }, pressed && styles.iconBtnPressed]}
                  accessibilityLabel="Notifications"
                  accessibilityRole="button"
                >
                  <Ionicons name="notifications-outline" size={ICON_SIZE} color={chatIconColor} />
                  {notificationCount > 0 && (
                    <View style={styles.bellBadge}>
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
                      { backgroundColor: isDark ? themeYellow + '22' : themeBlue + '0c', borderColor: chatOutlineColor },
                      pressed && styles.iconBtnPressed,
                      moreMenuOpen && { borderColor: themeYellow, backgroundColor: isDark ? themeYellow + '33' : themeBlue + '18' },
                    ]}
                    accessibilityLabel="More (admin)"
                    accessibilityState={{ expanded: moreMenuOpen }}
                  >
                    <Ionicons name="apps-outline" size={ICON_SIZE} color={chatIconColor} />
                  </Pressable>
              ) : null}
              <Pressable
                onPress={handleSupportPress}
                style={({ pressed }) => [
                  styles.iconBtn,
                  { backgroundColor: isDark ? themeYellow + '22' : themeBlue + '0c', borderColor: chatOutlineColor },
                  pressed && styles.iconBtnPressed,
                ]}
                accessibilityLabel="Chat support"
              >
                <Ionicons name="chatbubbles-outline" size={ICON_SIZE} color={chatIconColor} />
              </Pressable>
              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [
                  styles.iconBtn,
                  { backgroundColor: isDark ? themeYellow + '22' : themeBlue + '0c', borderColor: isDark ? themeYellow : themeBlue },
                  pressed && styles.iconBtnPressed,
                ]}
                accessibilityLabel="Sign out"
              >
                <Ionicons name="log-out-outline" size={ICON_SIZE} color={themeYellow} />
              </Pressable>
            </View>
          </View>
        )}
        <View style={[styles.underline, { backgroundColor: colors.border }]} />
      </View>
      <LinearGradient
        colors={[themeYellow, themeYellow, isDark ? themeYellow : themeBlue, isDark ? themeYellow : themeBlue]}
        locations={[0, 0.58, 0.62, 1]}
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
                    router.push(item.href as any);
                  }}
                  style={({ pressed }) => [
                    styles.moreItem,
                    index < ADMIN_MORE_LINKS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons name={item.icon} size={20} color={themeYellow} />
                  <ThemedText style={[styles.moreItemLabel, { color: colors.text }]}>{item.label}</ThemedText>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  bar: {
    paddingVertical: Spacing.sm,
  },
  underline: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
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
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  breadcrumb: {
    fontSize: 13,
    fontWeight: '600',
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
    borderRadius: ICON_BTN_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.md,
    minWidth: 0,
  },
  titleAccentBar: {
    width: 3,
    height: 18,
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  titleShadowDark: {
    textShadowColor: 'rgba(234, 179, 8, 0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBtn: {
    width: ICON_BTN_SIZE,
    height: ICON_BTN_SIZE,
    borderRadius: ICON_BTN_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  iconBtnPressed: {
    opacity: 0.8,
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
    backgroundColor: themeYellow,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: themeBlue,
  },
  accent: {
    height: ACCENT_HEIGHT,
    marginHorizontal: Spacing.lg,
    borderBottomLeftRadius: ACCENT_HEIGHT,
    borderBottomRightRadius: ACCENT_HEIGHT,
    overflow: 'hidden',
  },
  moreOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingTop: 60,
    paddingRight: Spacing.lg,
    alignItems: 'flex-end',
  },
  moreDropdown: {
    minWidth: 220,
    maxWidth: 280,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: Spacing.xs,
  },
  moreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  moreItemLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
});
