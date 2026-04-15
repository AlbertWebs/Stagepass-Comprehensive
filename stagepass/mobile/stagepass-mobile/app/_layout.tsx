import 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ThemePreferenceProvider } from '@/context/ThemePreferenceContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { setOnUnauthorized } from '~/services/api';
import { store } from '~/store';
import { logout, setCredentials, setLoading } from '~/store/authSlice';
import { clearSessionAfterAuthFailure, clearStoredToken, hydrateAuth, loadStoredToken } from '~/store/persistAuth';

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
    let cancelled = false;
    (async () => {
      const t = await loadStoredToken();
      if (cancelled) return;
      if (t) {
        await hydrateAuth(t, (p) => dispatch(setCredentials(p)));
      }
      if (cancelled) return;
      dispatch(setLoading(false));
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    setOnUnauthorized(() => {
      dispatch(logout());
      // If we're already on an auth screen, preserve the biometric token so Face ID /
      // fingerprint can still be offered after logout.
      if (onAuthScreen) {
        void clearStoredToken();
      } else {
        void clearSessionAfterAuthFailure(true);
      }
    });
    return () => setOnUnauthorized(null);
  }, [dispatch, onAuthScreen]);

  const shouldRedirectToLogin = !isLoading && !token && !onAuthScreen;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <>
          <Stack
            screenOptions={{
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
            <Stack.Screen name="events/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          {shouldRedirectToLogin && <Redirect href="/login" />}
        </>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <ThemePreferenceProvider>
          <RootLayoutNav />
        </ThemePreferenceProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}
