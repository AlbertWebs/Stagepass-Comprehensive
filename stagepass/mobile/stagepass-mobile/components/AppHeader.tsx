/**
 * Shared app header: page title (from route or prop) + notification bell.
 * Styled as a distinct bar (theme blue, white text) so it stands out from page content.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';

const PADDING_H = Spacing.lg;
const BELL_SIZE = 20;
const NOTIFICATION_BADGE_SIZE = 8;

/** Matches tab/screen titles: Home, My Events, Activities, Profile, Logout; Event detail uses title prop. */
const ROUTE_TITLES: Record<string, string> = {
  '': 'Home',
  '/': 'Home',
  '/(tabs)': 'Home',
  '/(tabs)/': 'Home',
  '/(tabs)/events': 'My Events',
  '/(tabs)/activity': 'Activities',
  '/(tabs)/profile': 'Profile',
  '/(tabs)/logout': 'Logout',
};

function getTitleFromPath(pathname: string): string {
  const normalized = (pathname || '').replace(/\/$/, '') || '/(tabs)';
  if (ROUTE_TITLES[normalized]) return ROUTE_TITLES[normalized];
  if (normalized.startsWith('/events/') || /^\/events\/[^/]+$/.test(normalized)) return 'Event';
  return 'Stagepass';
}

export interface AppHeaderProps {
  /** Override title (e.g. event name on event detail). */
  title?: string;
}

export function AppHeader({ title }: AppHeaderProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const displayTitle = title ?? getTitleFromPath(pathname);

  return (
    <View style={[styles.outer, { paddingTop: Math.max(insets.top, Spacing.sm) }]}>
      <View style={styles.bar}>
        <View style={styles.row}>
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
