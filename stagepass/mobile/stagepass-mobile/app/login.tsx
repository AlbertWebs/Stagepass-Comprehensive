/**
 * Login screen – modern UX: in-button loading, smooth transition to home.
 * Logo, Welcome Back, username + 4-digit PIN, Sign In button (Loading… + spinner when submitting).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { api, getApiBase, setAuthToken } from '~/services/api';
import { setCredentials } from '~/store/authSlice';
import { getDevicePushTokenAsync } from '~/utils/pushToken';
import { getLastUsername, getLoginLockoutUntil, saveToken, setLastUsername, setLoginLockoutUntil } from '~/store/persistAuth';
import { ThemedText } from '@/components/themed-text';
import { useThemePreference } from '@/context/ThemePreferenceContext';
import { BorderRadius, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

const U = { xs: 6, sm: 8, md: 12, lg: 14, xl: 16, section: 24 };
const CARD_RADIUS = 12;
const INPUT_RADIUS = 10;
const PIN_LENGTH = 4;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const dispatch = useDispatch();
  const router = useRouter();
  const exitOpacity = useSharedValue(1);
  const exitTranslateY = useSharedValue(0);
  const { colors, isDark } = useStagePassTheme();
  const { setPreference } = useThemePreference();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getLoginLockoutUntil().then((until) => {
      if (until && until > Date.now()) setLockoutUntil(until);
      else setLockoutUntil(null);
    });
    getLastUsername().then((u) => {
      if (u) setUsername(u);
    });
  }, []);

  const navigateToHome = () => router.replace('/(tabs)');

  useEffect(() => {
    if (!isExiting) return;
    const duration = 380;
    exitOpacity.value = withTiming(0, { duration }, (finished) => {
      if (finished) runOnJS(navigateToHome)();
    });
    exitTranslateY.value = withTiming(-12, { duration });
  }, [isExiting, exitOpacity, exitTranslateY]);

  const exitAnimatedStyle = useAnimatedStyle(() => ({
    opacity: exitOpacity.value,
    transform: [{ translateY: exitTranslateY.value }],
  }));

  const isLocked = lockoutUntil != null && lockoutUntil > Date.now();
  const lockoutMinsLeft =
    isLocked && lockoutUntil ? Math.ceil((lockoutUntil - Date.now()) / 60000) : 0;

  const handleLogin = async () => {
    if (isLocked) return;
    const trimmedUser = username.trim();
    if (!trimmedUser) {
      Alert.alert('Error', 'Please enter your username or Staff ID.');
      return;
    }
    if (!pin || pin.length < PIN_LENGTH) {
      Alert.alert('Error', `Please enter your ${PIN_LENGTH}-digit PIN.`);
      return;
    }
    setLoading(true);
    if (__DEV__) {
      console.warn('[Login] Sending request to', getApiBase(), '...');
    }
    try {
      const fcmToken = await getDevicePushTokenAsync();
      const res = await api.auth.login(trimmedUser, pin, fcmToken ?? undefined);
      if (__DEV__) console.warn('[Login] Success, token received');
      setAuthToken(res.token);
      await saveToken(res.token);
      await setLastUsername(trimmedUser);
      const me = await api.auth.me();
      dispatch(setCredentials({ user: me, token: res.token }));
      setFailedAttempts(0);
      setIsExiting(true);
      return;
    } catch (e: unknown) {
      setLoading(false);
      if (__DEV__) console.warn('[Login] Error', e);
      const message = e instanceof Error ? e.message : 'Invalid username or PIN.';
      const isNetworkError =
        message === 'Network request failed' ||
        message.toLowerCase().includes('network') ||
        (e instanceof TypeError && (e.message === 'Network request failed' || e.message.includes('fetch')));
      if (isNetworkError) {
        const base = getApiBase();
        const isLocalhost = /localhost|127\.0\.0\.1/.test(base);
        const deviceHint = isLocalhost
          ? "On a phone or tablet, localhost doesn't work. In the app's .env set EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:8000, then restart Expo (npx expo start -c).\n\n"
          : '';
        Alert.alert(
          'Connection failed',
          `Cannot reach: ${base}\n\n` +
            deviceHint +
            '1. Start the API: cd backend/laravel-api && php artisan serve --host=0.0.0.0\n' +
            '2. Phone and PC must be on the same Wi‑Fi. Use your PC IP in .env if on device.\n' +
            '3. Tap Retry after the server is reachable.',
          [{ text: 'OK' }, { text: 'Retry', onPress: () => handleLogin() }]
        );
      } else {
        const next = failedAttempts + 1;
        setFailedAttempts(next);
        if (next >= MAX_FAILED_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
          await setLoginLockoutUntil(until);
          setLockoutUntil(until);
          Alert.alert('Account locked', `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`);
        } else {
          Alert.alert('Login failed', message);
        }
      }
    }
  };

  const toggleTheme = () => {
    setPreference(isDark ? 'light' : 'dark');
  };

  const bgColor = isDark ? themeBlue : '#e8eaef';
  const cardBg = isDark ? 'rgba(40,45,65,0.95)' : '#ffffff';
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';
  const accentColor = themeYellow;
  const titleColor = isDark ? '#fff' : colors.text;
  const subtitleColor = isDark ? 'rgba(255,255,255,0.85)' : colors.textSecondary;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Animated.View style={[styles.keyboardWrap, exitAnimatedStyle]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + U.lg, paddingBottom: insets.bottom + U.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Theme toggle – top right */}
          <View style={styles.headerRow}>
            <View style={styles.headerSpacer} />
            <Pressable onPress={toggleTheme} style={({ pressed }) => [styles.themeBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons
                name={isDark ? 'moon' : 'sunny'}
                size={24}
                color={isDark ? '#fff' : colors.text}
              />
            </Pressable>
          </View>

          {/* Logo + wordmark */}
          <View style={styles.logoSection}>
            <View style={[styles.logoBox, { backgroundColor: accentColor }]}>
              <Ionicons name="ticket" size={32} color="#fff" />
            </View>
            <ThemedText style={[styles.wordmark, { color: isDark ? '#fff' : colors.text }]}>
              StagePass
            </ThemedText>
          </View>

          {/* Form card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
            <ThemedText style={[styles.welcomeTitle, { color: titleColor }]}>Welcome Back</ThemedText>
            <ThemedText style={[styles.welcomeSubtitle, { color: subtitleColor }]}>
              Log in to manage your events and tickets
            </ThemedText>

            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: subtitleColor }]}>Username</ThemedText>
              <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                <Ionicons name="person-outline" size={20} color={accentColor} style={styles.inputIcon} />
                <TextInput
                  placeholder="Enter your username"
                  placeholderTextColor={colors.placeholder}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading && !isLocked}
                  autoComplete="username"
                  style={[styles.input, { color: colors.text }]}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.pinLabelRow}>
                <ThemedText style={[styles.fieldLabel, { color: subtitleColor }]}>4-Digit PIN</ThemedText>
                <Pressable onPress={() => router.push('/forgot-password')} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <ThemedText style={[styles.forgotLink, { color: accentColor }]}>Forgot PIN?</ThemedText>
                </Pressable>
              </View>
              <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                <Ionicons name="lock-closed-outline" size={20} color={accentColor} style={styles.inputIcon} />
                <TextInput
                  placeholder="••••"
                  placeholderTextColor={colors.placeholder}
                  value={pin}
                  onChangeText={(text) => setPin(text.replace(/\D/g, '').slice(0, PIN_LENGTH))}
                  secureTextEntry
                  editable={!loading && !isLocked}
                  keyboardType="number-pad"
                  maxLength={PIN_LENGTH}
                  style={[styles.input, styles.pinInput, { color: colors.text }]}
                />
              </View>
            </View>

            {isLocked ? (
              <ThemedText style={[styles.lockoutText, { color: colors.error }]}>
                Try again in {lockoutMinsLeft} minute{lockoutMinsLeft !== 1 ? 's' : ''}
              </ThemedText>
            ) : (
              <Pressable
                onPress={handleLogin}
                disabled={loading}
                style={({ pressed }) => [
                  styles.loginBtn,
                  { backgroundColor: accentColor, opacity: loading ? 1 : pressed ? 0.9 : 1 },
                ]}
              >
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" style={styles.loginSpinner} />
                    <ThemedText style={styles.loginBtnText}>Loading…</ThemedText>
                  </>
                ) : (
                  <>
                    <ThemedText style={styles.loginBtnText}>Sign In</ThemedText>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </Pressable>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <ThemedText style={[styles.footerText, { color: subtitleColor }]}>New to StagePass?</ThemedText>
            <Pressable onPress={() => router.push('/forgot-password')} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <ThemedText style={[styles.footerLink, { color: accentColor }]}>Request Access</ThemedText>
            </Pressable>
          </View>
          <View style={styles.footerIcons}>
            <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Ionicons name="help-circle-outline" size={22} color={subtitleColor} />
            </Pressable>
            <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Ionicons name="globe-outline" size={22} color={subtitleColor} />
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardWrap: { flex: 1 },
  keyboard: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: U.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: U.section,
  },
  headerSpacer: { width: 40 },
  themeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: U.section,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: U.md,
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: CARD_RADIUS,
    padding: U.xl,
    marginBottom: U.section,
    borderWidth: StyleSheet.hairlineWidth,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: U.sm,
  },
  welcomeSubtitle: {
    fontSize: 14,
    marginBottom: U.xl,
  },
  fieldGroup: { marginBottom: U.lg },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: U.sm },
  pinLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: U.sm,
  },
  forgotLink: { fontSize: 14, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: INPUT_RADIUS,
    minHeight: 48,
  },
  inputIcon: { marginLeft: U.lg },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: U.md,
    paddingVertical: U.md,
  },
  pinInput: { letterSpacing: 4 },
  lockoutText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: U.lg,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: U.sm,
    marginTop: U.lg,
    minHeight: 52,
    borderRadius: INPUT_RADIUS,
  },
  loginBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  loginSpinner: {
    marginRight: U.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: U.sm,
    marginBottom: U.md,
  },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: '700' },
  footerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: U.xl,
  },
});
