/**
 * Shared app header: page title (from route or prop) + notification bell + logout.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { api } from '~/services/api';
import { logout } from '~/store/authSlice';
import { clearStoredToken } from '~/store/persistAuth';

const PADDING_H = Spacing.lg;
const BELL_SIZE = 20;
const NOTIFICATION_BADGE_SIZE = 8;

/** Matches tab/screen titles. */
const ROUTE_TITLES: Record<string, string> = {
  '': 'Home',
  '/': 'Home',
  '/(tabs)': 'Home',
  '/(tabs)/': 'Home',
  '/(tabs)/events': 'My Events',
  '/(tabs)/activity': 'Activities',
  '/(tabs)/profile': 'Profile',
  '/(tabs)/logout': 'Logout',
  events: 'My Events',
  '/events': 'My Events',
  activity: 'Activities',
  '/activity': 'Activities',
  profile: 'Profile',
  '/profile': 'Profile',
  logout: 'Logout',
  '/logout': 'Logout',
};

const SEGMENT_TITLES: Record<string, string> = {
  index: 'Home',
  events: 'My Events',
  activity: 'Activities',
  profile: 'Profile',
  logout: 'Logout',
};

/** Admin route segment → title (for when we're on an admin screen). */
const ADMIN_SEGMENT_TITLES: Record<string, string> = {
  users: 'Users & Crew',
  events: 'Events',
  equipment: 'Equipment',
  clients: 'Clients',
  reports: 'Reports',
  payments: 'Payments',
  timeoff: 'Time Off',
  communications: 'Communication',
  settings: 'Settings',
  audit: 'Audit Logs',
  create: 'Create event',
  edit: 'Edit event',
  crew: 'Crew',
  operations: 'Operations',
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

export interface AppHeaderProps {
  /** Override title (e.g. event name on event detail). */
  title?: string;
  /** Show back button (e.g. on create/edit stack screens). */
  showBack?: boolean;
  /** Custom back action when there is no history (e.g. replace to events list). */
  onBack?: () => void;
}

export function AppHeader({ title, showBack, onBack }: AppHeaderProps = {}) {
  const router = useRouter();
  const dispatch = useDispatch();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const displayTitle = title ?? getTitleFromPath(pathname);

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

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={[styles.outer, { paddingTop: Math.max(insets.top, Spacing.sm) }]}>
      <View style={styles.bar}>
        <View style={styles.row}>
          {showBack ? (
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.backBtn, pressed && styles.bellBtnPressed]}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </Pressable>
          ) : null}
          <View style={styles.titleWrap}>
            <ThemedText style={styles.title} numberOfLines={1}>
              {displayTitle}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/activity')}
            style={({ pressed }) => [styles.bellBtn, pressed && styles.bellBtnPressed]}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
          >
            <Ionicons name="notifications-outline" size={BELL_SIZE} color={themeYellow} />
            <View style={styles.badge} />
          </Pressable>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [styles.logoutBtn, pressed && styles.bellBtnPressed]}
            accessibilityLabel="Sign out"
            accessibilityRole="button"
          >
            <Ionicons name="log-out-outline" size={BELL_SIZE} color={themeYellow} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: 0,
    marginBottom: Spacing.md,
  },
  bar: {
    backgroundColor: themeBlue,
    paddingVertical: Spacing.xs,
    paddingHorizontal: PADDING_H,
    borderBottomWidth: 2,
    borderBottomColor: themeYellow,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.xs,
  },
  titleWrap: {
    flex: 1,
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.25,
    color: '#FFFFFF',
  },
  bellBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  logoutBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginLeft: Spacing.xs,
  },
  bellBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    opacity: 1,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: NOTIFICATION_BADGE_SIZE,
    height: NOTIFICATION_BADGE_SIZE,
    borderRadius: NOTIFICATION_BADGE_SIZE / 2,
    backgroundColor: themeYellow,
  },
});
