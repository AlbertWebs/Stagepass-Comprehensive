import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { StagePassButton } from '@/components/StagePassButton';
import { useNavigationPress } from '@/src/utils/navigationPress';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, StagePassColors } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { logout } from '~/store/authSlice';
import { clearStoredToken } from '~/store/persistAuth';
import { api } from '~/services/api';

export function NoEventTodayScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const handleNav = useNavigationPress();
  const { colors, isDark } = useStagePassTheme();
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await api.auth.logout();
    } catch {
      // offline or already invalid
    }
    await clearStoredToken();
    dispatch(logout());
    router.replace('/login');
    setSigningOut(false);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={[styles.title, { color: StagePassColors.themeBlue }]}>
        No Event Assigned Today
      </ThemedText>
      <ThemedText style={[styles.subtitle, { color: isDark ? '#F9FAFB' : '#0F172A' }]}>
        You don't have an event assigned for today. Check the Events tab for upcoming assignments or contact your team leader.
      </ThemedText>
      <StagePassButton
        title="View all events"
        onPress={() => handleNav(() => router.push('/(tabs)/events'))}
        variant="primary"
        style={styles.cta}
      />
      <StagePassButton
        title="Sign out"
        onPress={handleLogout}
        variant="outline"
        style={styles.logout}
        loading={signingOut}
        disabled={signingOut}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.xxl,
    paddingTop: Spacing.section,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.xxl,
    textAlign: 'center',
  },
  cta: {
    marginBottom: Spacing.md,
  },
  logout: {
    marginTop: Spacing.sm,
  },
});
