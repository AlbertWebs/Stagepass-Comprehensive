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
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { api, getApiBase, setAuthToken, suppressUnauthorizedForMs } from '~/services/api';
import { setCredentials } from '~/store/authSlice';
import { getDevicePushTokenAsync } from '~/utils/pushToken';
import {
  fetchServerAllowsBiometricLogin,
  getBiometricIconName,
  getBiometricLabel,
  getBiometricLoginEnabled,
  hasBiometricStoredToken,
  isBiometricHardwareAvailable,
  refreshBiometricCredentialIfEnabled,
  unlockWithBiometric,
} from '~/store/biometricLogin';
import {
  clearLoginLockout,
  clearSessionAfterAuthFailure,
  getLastUsername,
  getLoginLockoutUntil,
  saveToken,
  setLastUsername,
  setLoginLockoutUntil,
} from '~/store/persistAuth';
import { StagepassFaviconLogo } from '@/components/StagepassFaviconLogo';
import { ThemedText } from '@/components/themed-text';
import { useThemePreference } from '@/context/ThemePreferenceContext';
import { Buttons, Cards, Form, Icons, Typography, UI } from '@/constants/ui';
import { Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { NAV_PRESSED_OPACITY, useNavigationPress } from '@/src/utils/navigationPress';

const PIN_LENGTH = 4;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  /** User opted in (Profile); survives sign-out. */
  const [biometricOptIn, setBiometricOptIn] = useState(false);
  /** Secure token present for Face ID / fingerprint button. */
  const [hasBiometricToken, setHasBiometricToken] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometric');
  const [biometricIconName, setBiometricIconName] = useState<
    'scan-outline' | 'finger-print-outline' | 'eye-outline'
  >('finger-print-outline');
  const [serverAllowsBiometric, setServerAllowsBiometric] = useState(true);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const dispatch = useDispatch();
  const router = useRouter();
  const handleNav = useNavigationPress();
  const exitOpacity = useSharedValue(1);
  const exitTranslateY = useSharedValue(0);
  const { colors, isDark } = useStagePassTheme();
  const { setPreference } = useThemePreference();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Login should default to system appearance (auto), not forced light/dark.
    setPreference('system');
    // Clear stale lockout locally so QA/dev users can retry immediately.
    clearLoginLockout().then(() => {
      setLockoutUntil(null);
      setFailedAttempts(0);
    });
    getLastUsername().then((u) => {
      if (u) setUsername(u);
    });
    let mounted = true;
    (async () => {
      const [hw, optIn, hasToken, label, iconName] = await Promise.all([
        isBiometricHardwareAvailable(),
        getBiometricLoginEnabled(),
        hasBiometricStoredToken(),
        getBiometricLabel(),
        getBiometricIconName(),
      ]);
      if (!mounted) return;
      setBiometricAvailable(hw);
      setBiometricOptIn(optIn);
      setHasBiometricToken(hasToken);
      setBiometricLabel(label);
      setBiometricIconName(iconName);
      const allowed = await fetchServerAllowsBiometricLogin();
      if (!mounted) return;
      setServerAllowsBiometric(allowed);
    })();
    return () => {
      mounted = false;
    };
  }, [setPreference]);

  // Welcome title personalization (avoid showing template placeholders like {{First Name}}).
  useEffect(() => {
    if (isLocked) return;
    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setFirstName(null);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const displayName = await api.auth.getLoginDisplayName(trimmedUser);
        if (cancelled) return;
        if (!displayName) {
          setFirstName(null);
          return;
        }
        const token = displayName.trim().split(/\s+/)[0];
        setFirstName(token || null);
      } catch {
        // ignore; keep default greeting
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username, isLocked]);

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

  const handleBiometricLogin = async () => {
    if (isLocked || biometricLoading) return;
    const hasStored = await hasBiometricStoredToken();
    if (!hasStored) {
      // Face unlock token hasn't been saved yet (or was cleared). If the user already entered
      // username + PIN, treat this biometric button as a fallback and complete sign-in.
      const trimmedUser = username.trim();
      const pinOk = !!pin && pin.length >= PIN_LENGTH;
      if (trimmedUser && pinOk) {
        await handleLogin();
        return;
      }
      setHasBiometricToken(false);
      Alert.alert(
        'Biometric sign-in',
        'There is no saved session for biometric unlock. Sign in with your username and PIN once, then you can use biometrics again.'
      );
      return;
    }
    setBiometricLoading(true);
    try {
      const { token: raw, userCancelled } = await unlockWithBiometric();
      const token = raw?.trim();
      if (!token) {
        if (!userCancelled) {
          Alert.alert(
            'Biometric sign-in',
            'Biometric unlock did not complete. Sign in with your username and PIN.'
          );
        }
        setBiometricLoading(false);
        return;
      }
      setAuthToken(token);
      await saveToken(token);
      let user: Awaited<ReturnType<typeof api.auth.me>> | null = null;
      try {
        user = await api.auth.meLocal401();
      } catch {
        await clearSessionAfterAuthFailure();
        setBiometricLoading(false);
        // Token was rejected by the server (common after logout).
        // If the user already entered username + PIN, fall back automatically.
        const trimmedUser = username.trim();
        const pinOk = !!pin && pin.length >= PIN_LENGTH;
        if (trimmedUser && pinOk) {
          setHasBiometricToken(false);
          await handleLogin();
          return;
        }
        setHasBiometricToken(false);
        Alert.alert(
          'Session expired',
          'Please sign in with your username and PIN once to refresh biometric login.'
        );
        return;
      }
      dispatch(setCredentials({ user, token }));
      suppressUnauthorizedForMs(60000);
      const fcmToken = await getDevicePushTokenAsync();
      if (fcmToken) api.auth.updateProfileLocal401({ fcm_token: fcmToken }).catch(() => {});
      setFailedAttempts(0);
      setIsExiting(true);
    } catch (e) {
      Alert.alert('Biometric sign-in', e instanceof Error ? e.message : 'Could not sign in.');
    } finally {
      setBiometricLoading(false);
    }
  };

  async function handleLogin() {
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
      let user = res.user;
      try {
        const me = await api.auth.me();
        user = me;
      } catch {
        // /me failed; use login user. Home will refetch /me on focus and get office check-in state.
      }
      dispatch(setCredentials({ user, token: res.token }));
      setFailedAttempts(0);
      await refreshBiometricCredentialIfEnabled(res.token);
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
  }

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
  const welcomeTitle = firstName ? `Welcome Back ${firstName}` : 'Welcome Back';

  const showBiometricSignIn =
    serverAllowsBiometric && biometricOptIn && biometricAvailable;
  const showBiometricHintProfile =
    serverAllowsBiometric && biometricAvailable && !biometricOptIn;
  const signInRowMarginTop = showBiometricHintProfile ? Spacing.md : Spacing.lg;

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
            { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl * 2 },
          ]}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {/* Theme toggle – top right */}
          <View style={styles.headerRow}>
            <View style={styles.headerSpacer} />
            <Pressable onPress={toggleTheme} style={({ pressed }) => [styles.themeBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons
                name={isDark ? 'moon' : 'sunny'}
                size={Icons.xl}
                color={isDark ? '#fff' : colors.text}
              />
            </Pressable>
          </View>

          {/* Logo + wordmark */}
          <View style={styles.logoSection}>
            <View style={styles.logoIconWrap}>
              <StagepassFaviconLogo size={64} />
            </View>
            <ThemedText type="titleLarge" style={[styles.wordmark, { color: isDark ? '#fff' : colors.text }]}>
              Stagepass Crew
            </ThemedText>
          </View>

          {/* Form card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
            <ThemedText style={[styles.welcomeTitle, { color: titleColor }]}>
              {welcomeTitle}
            </ThemedText>
            <ThemedText type="bodySmall" style={[styles.welcomeSubtitle, { color: subtitleColor }]}>
              Log in to manage your events and tickets
            </ThemedText>

            <View style={styles.fieldGroup}>
              <ThemedText type="label" style={[styles.fieldLabel, { color: subtitleColor }]}>Username</ThemedText>
              <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                <Ionicons name="person-outline" size={Icons.standard} color={accentColor} style={styles.inputIcon} />
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
                <ThemedText type="label" style={[styles.fieldLabel, { color: subtitleColor }]}>4-Digit PIN</ThemedText>
                <Pressable onPress={() => handleNav(() => router.push('/forgot-password'))} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? NAV_PRESSED_OPACITY : 1 })}>
                  <ThemedText type="link" style={[styles.forgotLink, { color: accentColor }]}>Forgot PIN?</ThemedText>
                </Pressable>
              </View>
              <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                <Ionicons name="lock-closed-outline" size={Icons.standard} color={accentColor} style={styles.inputIcon} />
                <TextInput
                  placeholder="••••"
                  placeholderTextColor={colors.placeholder}
                  value={pin}
                  onChangeText={(text) => setPin(text.replace(/\D/g, '').slice(0, PIN_LENGTH))}
                  secureTextEntry={!showPin}
                  editable={!loading && !isLocked}
                  keyboardType="number-pad"
                  maxLength={PIN_LENGTH}
                  style={[styles.input, styles.pinInput, { color: colors.text }]}
                />
                <Pressable
                  onPress={() => setShowPin((v) => !v)}
                  disabled={loading || isLocked}
                  style={({ pressed }) => [styles.pinToggleBtn, { opacity: pressed ? NAV_PRESSED_OPACITY : 1 }]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  <Ionicons
                    name={showPin ? 'eye-off-outline' : 'eye-outline'}
                    size={Icons.standard}
                    color={accentColor}
                  />
                </Pressable>
              </View>
            </View>

            {isLocked ? (
              <ThemedText type="bodySmall" style={[styles.lockoutText, { color: colors.error }]}>
                Try again in {lockoutMinsLeft} minute{lockoutMinsLeft !== 1 ? 's' : ''}
              </ThemedText>
            ) : (
              <>
                {showBiometricHintProfile ? (
                  <View style={styles.biometricHintBox}>
                    <Ionicons name="finger-print-outline" size={Icons.small} color={subtitleColor} />
                    <Text style={[styles.biometricHintText, { color: subtitleColor }]}>
                      After you sign in, open{' '}
                      <Text style={{ fontWeight: '700', color: colors.text }}>Profile</Text>
                      {' '}to turn on{' '}
                      <Text style={{ fontWeight: '700', color: colors.text }}>{biometricLabel}</Text>
                      {' '}for faster sign-in next time.
                    </Text>
                  </View>
                ) : null}
                {showBiometricSignIn ? (
                  <View style={[styles.signInActionsRow, { marginTop: signInRowMarginTop }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Sign in with ${biometricLabel}`}
                      disabled={biometricLoading}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      onPress={handleBiometricLogin}
                      style={({ pressed }) => [
                        styles.biometricBtnSide,
                        {
                          borderColor: accentColor,
                          opacity: biometricLoading
                            ? 0.92
                            : hasBiometricToken
                              ? pressed
                                ? 0.88
                                : 1
                              : 0.75,
                        },
                      ]}
                    >
                      {biometricLoading ? (
                        <View style={styles.biometricBtnSideInner}>
                          <ActivityIndicator size="small" color={accentColor} />
                          <ThemedText
                            numberOfLines={1}
                            style={[styles.biometricBtnSideCaption, { color: accentColor }]}
                          >
                            Signing in…
                          </ThemedText>
                        </View>
                      ) : (
                        <View style={styles.biometricBtnSideInner}>
                          <Ionicons name={biometricIconName} size={Icons.header} color={accentColor} />
                          <ThemedText
                            numberOfLines={2}
                            style={[styles.biometricBtnSideCaption, { color: accentColor }]}
                          >
                            {biometricLabel}
                          </ThemedText>
                        </View>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={handleLogin}
                      disabled={loading}
                      style={({ pressed }) => [
                        styles.loginBtn,
                        styles.loginBtnWider,
                        {
                          backgroundColor: accentColor,
                          opacity: loading ? 1 : pressed ? 0.9 : 1,
                        },
                      ]}
                    >
                      {loading ? (
                        <>
                          <ActivityIndicator size="small" color="#fff" style={styles.loginSpinner} />
                          <ThemedText type="buttonText" style={styles.loginBtnText}>Loading…</ThemedText>
                        </>
                      ) : (
                        <>
                          <ThemedText type="buttonText" style={styles.loginBtnText}>Sign In</ThemedText>
                          <Ionicons name="arrow-forward" size={Icons.standard} color="#fff" />
                        </>
                      )}
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={handleLogin}
                    disabled={loading}
                    style={({ pressed }) => [
                      styles.loginBtn,
                      {
                        backgroundColor: accentColor,
                        opacity: loading ? 1 : pressed ? 0.9 : 1,
                        marginTop: serverAllowsBiometric && biometricAvailable ? Spacing.md : 0,
                      },
                    ]}
                  >
                    {loading ? (
                      <>
                        <ActivityIndicator size="small" color="#fff" style={styles.loginSpinner} />
                        <ThemedText type="buttonText" style={styles.loginBtnText}>Loading…</ThemedText>
                      </>
                    ) : (
                      <>
                        <ThemedText type="buttonText" style={styles.loginBtnText}>Sign In</ThemedText>
                        <Ionicons name="arrow-forward" size={Icons.standard} color="#fff" />
                      </>
                    )}
                  </Pressable>
                )}
              </>
            )}
          </View>

          <View style={styles.footerIcons}>
            <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Ionicons name="help-circle-outline" size={Icons.header} color={subtitleColor} />
            </Pressable>
            <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Ionicons name="globe-outline" size={Icons.header} color={subtitleColor} />
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
    paddingHorizontal: Spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: UI.sectionGap,
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
    marginBottom: UI.sectionGap,
  },
  logoIconWrap: {
    marginBottom: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  wordmark: {
    fontSize: Typography.titleHero,
    fontWeight: Typography.titleLargeWeight,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: Cards.borderRadius,
    padding: Cards.padding,
    marginBottom: UI.sectionGap,
    borderWidth: StyleSheet.hairlineWidth,
  },
  welcomeTitle: {
    fontSize: Typography.titleWelcome,
    fontWeight: Typography.titleWelcomeWeight,
    marginBottom: Spacing.sm,
  },
  welcomeSubtitle: {
    marginBottom: Spacing.xl,
  },
  fieldGroup: { marginBottom: Spacing.lg },
  fieldLabel: { marginBottom: Spacing.sm },
  pinLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  forgotLink: {},
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Form.inputBorderRadius,
    minHeight: Form.inputMinHeight,
  },
  inputIcon: { marginLeft: Spacing.lg },
  input: {
    flex: 1,
    fontSize: Form.inputText,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  pinInput: { letterSpacing: 4 },
  pinToggleBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  lockoutText: {
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  biometricHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  biometricHintText: {
    flex: 1,
    fontSize: Typography.label,
    lineHeight: 18,
  },
  signInActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.md,
  },
  biometricBtnSide: {
    flex: 2,
    minHeight: Buttons.minHeight,
    minWidth: 0,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Form.inputBorderRadius,
    borderWidth: 2,
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  biometricBtnSideInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  biometricBtnSideCaption: {
    fontSize: Typography.label,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: UI.rowGap,
    marginTop: Spacing.lg,
    minHeight: Buttons.minHeight,
    minWidth: 0,
    borderRadius: Form.inputBorderRadius,
  },
  loginBtnWider: {
    flex: 3,
    marginTop: 0,
  },
  loginBtnText: {
    fontSize: Buttons.fontSize,
    fontWeight: Buttons.fontWeight,
    color: '#fff',
  },
  loginSpinner: {
    marginRight: UI.rowGap,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: UI.rowGap,
    marginBottom: Spacing.md,
  },
  footerText: {},
  footerLink: {},
  footerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
});
