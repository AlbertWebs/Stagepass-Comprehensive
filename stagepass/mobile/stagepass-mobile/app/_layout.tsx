import 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, Redirect, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { Outfit_400Regular } from '@expo-google-fonts/outfit/400Regular';
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import { Outfit_800ExtraBold } from '@expo-google-fonts/outfit/800ExtraBold';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { AppAlertHost } from '@/components/AppAlert';

import { ThemePreferenceProvider } from '@/context/ThemePreferenceContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { setOnUnauthorized } from '~/services/api';
import { api } from '~/services/api';
import { store, type RootState } from '~/store';
import { setOnboardingState } from '~/store/appSlice';
import { logout, setCredentials, setLoading } from '~/store/authSlice';
import { getOnboardingComplete } from '~/store/onboardingPrefs';
import { clearSessionAfterAuthFailure, clearStoredToken, hydrateAuth, loadStoredToken } from '~/store/persistAuth';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const dispatch = useDispatch();
  const token = useSelector((s: RootState) => s.auth.token);
  const isLoading = useSelector((s: RootState) => s.auth.isLoading);
  const onboardingHydrated = useSelector((s: RootState) => s.app.onboardingHydrated);
  const onboardingComplete = useSelector((s: RootState) => s.app.onboardingComplete);
  const segments = useSegments();
  const router = useRouter();
  const handledNotificationIds = useRef<Set<string>>(new Set());
  const onAuthScreen =
    segments[0] === 'login' || segments[0] === 'forgot-password' || segments[0] === 'onboarding';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [t, obDone] = await Promise.all([loadStoredToken(), getOnboardingComplete()]);
      if (cancelled) return;
      dispatch(setOnboardingState({ onboardingHydrated: true, onboardingComplete: obDone }));
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

  useEffect(() => {
    let receivedSubscription: { remove: () => void } | undefined;
    let responseSubscription: { remove: () => void } | undefined;
    let tokenSubscription: { remove: () => void } | undefined;
    let firebaseTokenSubscription: (() => void) | undefined;
    let disposed = false;

    const openNotificationDestination = (response: import('expo-notifications').NotificationResponse) => {
      const notificationId = response.notification.request.identifier;
      if (handledNotificationIds.current.has(notificationId)) return;
      handledNotificationIds.current.add(notificationId);

      const data = response.notification.request.content.data as Record<string, unknown>;
      const type = String(data.type ?? '');
      const eventId = String(data.event_id ?? '');
      const taskId = String(data.task_id ?? '');
      if (taskId) {
        router.push({ pathname: '/(tabs)/tasks/[id]', params: { id: taskId } } as never);
      } else if (type === 'internal_broadcast') {
        router.push('/(tabs)/messages');
      } else if (type === 'time_off_request_submitted') {
        router.push('/(tabs)/admin/timeoff');
      } else if (type.startsWith('time_off_')) {
        router.push('/(tabs)/profile');
      } else if (type.startsWith('allowance_') && eventId) {
        router.push({ pathname: '/(tabs)/admin/events/[id]/pending-allowances', params: { id: eventId } } as never);
      } else if (type.startsWith('office_')) {
        router.push({ pathname: '/(tabs)/admin/reports/[type]', params: { type: 'crew-attendance' } } as never);
      } else if (eventId) {
        router.push({ pathname: '/events/[id]', params: { id: eventId } } as never);
      } else {
        router.push('/(tabs)/activity');
      }
    };

    void import('expo-notifications').then(async (Notifications) => {
      if (disposed) return;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      receivedSubscription = Notifications.addNotificationReceivedListener(() => {
        // Foreground presentation is controlled by the notification handler above.
      });
      responseSubscription = Notifications.addNotificationResponseReceivedListener(openNotificationDestination);
      tokenSubscription = Notifications.addPushTokenListener((pushToken) => {
        if (Platform.OS === 'android' && typeof pushToken.data === 'string' && pushToken.data.length > 0) {
          void api.auth.updateProfile({ fcm_token: pushToken.data }).catch(() => {});
        }
      });
      if (Platform.OS === 'ios') {
        const firebaseMessaging = await import('@react-native-firebase/messaging');
        firebaseTokenSubscription = firebaseMessaging.onTokenRefresh(firebaseMessaging.getMessaging(), (token) => {
          void api.auth.updateProfile({ fcm_token: token }).catch(() => {});
        });
      }
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (!disposed && lastResponse) openNotificationDestination(lastResponse);
    }).catch(() => {});

    return () => {
      disposed = true;
      receivedSubscription?.remove();
      responseSubscription?.remove();
      tokenSubscription?.remove();
      firebaseTokenSubscription?.();
    };
  }, [router]);

  const shouldRedirectToOnboarding =
    onboardingHydrated && !onboardingComplete && segments[0] !== 'onboarding';
  const shouldRedirectToLogin =
    onboardingHydrated && onboardingComplete && !isLoading && !token && !onAuthScreen;

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
            <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
            <Stack.Screen name="events/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="events/request-allowance" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <AppAlertHost />
          {shouldRedirectToOnboarding && <Redirect href="/onboarding" />}
          {shouldRedirectToLogin && <Redirect href="/login" />}
        </>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  if (!fontsLoaded) return null;

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
