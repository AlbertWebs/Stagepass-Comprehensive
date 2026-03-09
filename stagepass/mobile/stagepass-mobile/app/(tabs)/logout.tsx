/**
 * Logout tab – triggers sign out and redirects to login.
 */
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, themeBlue } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api } from '~/services/api';
import { logout } from '~/store/authSlice';
import { clearStoredToken } from '~/store/persistAuth';

export default function LogoutScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await api.auth.logout();
      } catch {
        // ignore
      }
      if (!mounted) return;
      await clearStoredToken();
      dispatch(logout());
      router.replace('/login');
    })();
    return () => { mounted = false; };
  }, [dispatch, router]);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ActivityIndicator size="large" color={themeBlue} />
      <ThemedText style={[styles.text, { color: colors.textSecondary }]}>
        Signing out…
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  text: {
    marginTop: Spacing.lg,
    fontSize: 15,
  },
});
