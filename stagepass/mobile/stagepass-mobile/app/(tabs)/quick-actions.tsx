/**
 * Quick Actions – full-page grid of all quick actions for the current role.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { HomeHeader } from '@/components/HomeHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { QUICK_ACTIONS } from '@/constants/quickActions';
import { BorderRadius, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { NAV_PRESSED_OPACITY, useNavigationPress } from '@/src/utils/navigationPress';
import { useAppRole } from '~/hooks/useAppRole';

const U = { sm: 8, md: 12, lg: 16, xl: 20, section: 24 };
const CARD_RADIUS = 16;
const TAB_BAR_HEIGHT = 58;

export default function QuickActionsScreen() {
  const router = useRouter();
  const role = useAppRole();
  const { colors, isDark } = useStagePassTheme();
  const handleNav = useNavigationPress();
  const iconColor = isDark ? themeYellow : themeBlue;
  const cardBg = isDark ? '#1E212A' : '#F5F7FC';

  const visibleQuickActions = QUICK_ACTIONS.filter((a) => {
    if (a.id === 'everything') return false;
    if (!a.roles) return true;
    if (a.id === 'checkin') return a.roles.includes(role);
    return a.roles.includes(role);
  });

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="Quick actions" showBack onBack={() => router.back()} />
      <View style={[styles.scrollContent, { paddingBottom: TAB_BAR_HEIGHT + U.section }]}>
        <View style={styles.quickGrid}>
          {visibleQuickActions.map((action, index) => {
            const href = action.id === 'checkin' ? '/(tabs)/events' : action.href;
            return (
              <Animated.View
                key={action.id}
                entering={FadeIn.delay(index * 40).duration(280)}
                style={styles.quickCardWrap}
              >
                <Pressable
                  onPress={() => href && handleNav(() => router.push(href as any))}
                  style={({ pressed }) => [
                    styles.quickCard,
                    { backgroundColor: cardBg, borderColor: colors.border, opacity: pressed ? NAV_PRESSED_OPACITY : 1 },
                  ]}
                >
                  <View style={[styles.quickIconWrap, { backgroundColor: (isDark ? themeYellow : themeBlue) + '1a', borderColor: (isDark ? themeYellow : themeBlue) + '38' }]}>
                    <Ionicons name={action.icon as any} size={22} color={iconColor} />
                  </View>
                  <ThemedText style={[styles.quickLabel, { color: colors.text }]} numberOfLines={1}>
                    {action.label}
                  </ThemedText>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: U.lg,
    paddingTop: U.section,
    flexGrow: 1,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: U.sm,
    justifyContent: 'space-between',
  },
  quickCardWrap: {
    width: '48%',
    minWidth: '48%',
    maxWidth: '48%',
    flexShrink: 0,
  },
  quickCard: {
    padding: U.lg,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
    overflow: 'hidden',
  },
  quickIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: U.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
