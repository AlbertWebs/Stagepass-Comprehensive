import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ThemePreferenceProvider } from '@/context/ThemePreferenceContext';
import { StagepassLoader } from '@/components/StagepassLoader';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { setOnUnauthorized } from '~/services/api';
import { store } from '~/store';
import { logout, setCredentials, setLoading } from '~/store/authSlice';
import { clearStoredToken, hydrateAuth, loadStoredToken } from '~/store/persistAuth';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const dispatch = useDispatch();
  const token = useSelector((s: { auth: { token: string | null; isLoading: boolean } }) => s.auth.token);
  const isLoading = useSelector((s: { auth: { isLoading: boolean } }) => s.auth.isLoading);
  const segments = useSegments();
  const onAuthScreen = segments[0] === 'login' || segments[0] === 'forgot-password';

  useEffect(() => {
    loadStoredToken().then((t) => {
      if (t) {
        hydrateAuth(t, (p) => dispatch(setCredentials(p)));
      }
      dispatch(setLoading(false));
    });
  }, [dispatch]);

  useEffect(() => {
    setOnUnauthorized(() => {
      dispatch(logout());
      clearStoredToken();
    });
    return () => setOnUnauthorized(null);
  }, [dispatch]);

  const shouldRedirectToLogin = !isLoading && !token && !onAuthScreen;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {isLoading && <StagepassLoader message="Checking session…" fullScreen />}
        <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="events/[id]" options={{ title: 'Event' }} />
        <Stack.Screen name="request-time-off" options={{ title: 'Request time off' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
        {shouldRedirectToLogin && <Redirect href="/login" />}
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <ThemePreferenceProvider>
        <RootLayoutNav />
      </ThemePreferenceProvider>
    </Provider>
  );
}
