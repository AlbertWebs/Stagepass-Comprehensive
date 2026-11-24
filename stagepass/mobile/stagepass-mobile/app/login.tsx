/**
 * Login screen – modern UX: in-button loading, smooth transition to home.
 * Logo, Welcome Back, username + 4-digit PIN, Sign In button (Loading… + spinner when submitting).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { StagepassText as Text } from '@/components/StagepassText';
import { StagepassTextInput as TextInput } from '@/components/StagepassTextInput';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
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
  saveBiometricCredential,
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
import { useThemePreference } from '@/context/ThemePreferenceContext';
import { Icons } from '@/constants/ui';
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
  const isLocked = lockoutUntil != null && lockoutUntil > Date.now();
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
  const [biometricPromptVisible, setBiometricPromptVisible] = useState(false);
  const [biometricPromptToken, setBiometricPromptToken] = useState<string | null>(null);
  const [biometricPromptBusy, setBiometricPromptBusy] = useState(false);
  const [biometricPromptError, setBiometricPromptError] = useState<string | null>(null);
  const dispatch = useDispatch();
  const router = useRouter();
  const handleNav = useNavigationPress();
  const exitOpacity = useSharedValue(1);
  const exitTranslateY = useSharedValue(0);
  const fingerprintPulse = useSharedValue(0);
  const { colors, isDark } = useStagePassTheme();
  const { setPreference } = useThemePreference();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heroHeight = Math.max(160, Math.min(280, height * 0.29));
  const [focusedField, setFocusedField] = useState<'username' | 'pin' | null>(null);

  useEffect(() => {
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

  const dismissBiometricPrompt = () => {
    setBiometricPromptVisible(false);
    setBiometricPromptToken(null);
    setBiometricPromptError(null);
    setIsExiting(true);
  };

  const enableBiometricFromPrompt = async () => {
    if (!biometricPromptToken || biometricPromptBusy) return;
    setBiometricPromptBusy(true);
    setBiometricPromptError(null);
    try {
      await saveBiometricCredential(biometricPromptToken);
      setBiometricOptIn(true);
      setHasBiometricToken(true);
      setBiometricPromptVisible(false);
      setBiometricPromptToken(null);
      setIsExiting(true);
    } catch (error) {
      setBiometricPromptError(
        error instanceof Error && error.message === 'Cancelled'
          ? 'Biometric confirmation was canceled. You can try again or enable it later in your profile.'
          : error instanceof Error
            ? error.message
            : 'Could not enable biometric sign-in. You can try again from your profile.'
      );
    } finally {
      setBiometricPromptBusy(false);
    }
  };

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
      // Re-fetch token after auth is active (permission may resolve after the pre-login call).
      getDevicePushTokenAsync().then((t) => {
        if (t) api.auth.updateProfile({ fcm_token: t }).catch(() => {});
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (serverAllowsBiometric && biometricAvailable && !biometricOptIn) {
        setLoading(false);
        setBiometricPromptToken(res.token);
        setBiometricPromptError(null);
        setBiometricPromptVisible(true);
      } else {
        setIsExiting(true);
      }
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

  const toggleTheme = (x: number, y: number) => {
    const nextPreference = isDark ? 'light' : 'dark';
    setPreference(nextPreference, {
      origin: { x, y },
      color: nextPreference === 'dark' ? themeBlue : '#f2f4f8',
    });
  };

  const bgColor = isDark ? themeBlue : '#f2f4f8';
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : '#ffffff';
  const inputBorder = isDark ? 'rgba(195,205,229,0.55)' : 'rgba(17,24,39,0.18)';
  const accentColor = isDark ? themeYellow : '#765400';
  const titleColor = isDark ? '#fff' : '#111a31';
  const subtitleColor = isDark ? '#d7dced' : '#596276';
  const labelColor = isDark ? '#fff' : '#182138';
  const inputTextColor = isDark ? '#fff' : '#111a31';
  const placeholderColor = isDark ? '#aab3c9' : '#8991a1';
  const welcomeTitle = firstName ? `Welcome back, ${firstName}` : 'Welcome back';

  const showBiometricSignIn =
    serverAllowsBiometric && biometricOptIn && biometricAvailable && hasBiometricToken;
  const fingerprintPulseStyle = useAnimatedStyle(() => ({
    opacity: 1 - fingerprintPulse.value * 0.16,
    transform: [{ scale: 1 + fingerprintPulse.value * 0.1 }],
  }));

  useEffect(() => {
    if (!showBiometricSignIn || biometricLoading) {
      cancelAnimation(fingerprintPulse);
      fingerprintPulse.value = 0;
      return;
    }
    fingerprintPulse.value = withRepeat(
      withTiming(1, { duration: 760, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => cancelAnimation(fingerprintPulse);
  }, [biometricLoading, fingerprintPulse, showBiometricSignIn]);

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar style="light" />
      <Image
        source={require('../assets/images/login-unbranded-crew.webp')}
        contentFit="cover"
        contentPosition="left center"
        style={[styles.heroBackdrop, { height: heroHeight + insets.top + 32 }]}
      />
      <LinearGradient
        colors={['rgba(5,10,28,0.3)', 'rgba(7,20,47,0.82)', bgColor]}
        locations={[0, 0.62, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.heroGradient, { height: heroHeight + insets.top + 32 }]}
      />
      <Animated.View style={[styles.keyboardWrap, exitAnimatedStyle]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboard}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.xl },
            ]}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <View style={styles.headerRow}>
                <View style={styles.headerSpacer} />
                <Pressable
                  onPress={(event) => toggleTheme(event.nativeEvent.pageX, event.nativeEvent.pageY)}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} appearance`}
                  style={({ pressed }) => [styles.themeBtn, { opacity: pressed ? 0.75 : 1 }]}
                >
                  <Ionicons name={isDark ? 'moon' : 'sunny'} size={Icons.standard} color="#fff" />
                </Pressable>
              </View>

              <View style={[styles.brandBlock, { marginTop: heroHeight - 116 }]}>
                <View style={styles.logoIconWrap}>
                  <StagepassFaviconLogo size={64} />
                </View>
                <View style={styles.crewRow}>
                  <View style={styles.crewRule} />
                  <Text style={styles.crewLabel}>CREW</Text>
                  <View style={styles.crewRule} />
                </View>
              </View>

              <View style={[styles.card, { backgroundColor: isDark ? '#131f39' : '#fff' }]}>
                <Text style={[styles.welcomeTitle, { color: titleColor }]}>{welcomeTitle}</Text>
                <Text style={[styles.welcomeSubtitle, { color: subtitleColor }]}>
                  Manage your assignments, attendance and shifts.
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: labelColor }]}>Username</Text>
                  <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: focusedField === 'username' ? accentColor : inputBorder }]}>
                    <Ionicons name="person-outline" size={Icons.standard} color={accentColor} style={styles.inputIcon} />
                    <TextInput
                      placeholder="Enter your username"
                      accessibilityLabel="Username"
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(null)}
                      placeholderTextColor={placeholderColor}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading && !isLocked}
                      autoComplete="username"
                      style={[styles.input, { color: inputTextColor }]}
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <View style={styles.pinLabelRow}>
                    <Text style={[styles.fieldLabel, { color: labelColor, marginBottom: 0 }]}>4-digit PIN</Text>
                    <Pressable
                      onPress={() => handleNav(() => router.push('/forgot-password'))}
                      hitSlop={8}
                      style={({ pressed }) => ({ opacity: pressed ? NAV_PRESSED_OPACITY : 1 })}
                    >
                      <Text style={[styles.forgotLink, { color: accentColor }]}>Forgot PIN?</Text>
                    </Pressable>
                  </View>
                  <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: focusedField === 'pin' ? accentColor : inputBorder }]}>
                    <Ionicons name="lock-closed-outline" size={Icons.standard} color={accentColor} style={styles.inputIcon} />
                    <TextInput
                      placeholder="••••"
                      accessibilityLabel="4-digit PIN"
                      onFocus={() => setFocusedField('pin')}
                      onBlur={() => setFocusedField(null)}
                      placeholderTextColor={placeholderColor}
                      value={pin}
                      onChangeText={(text) => setPin(text.replace(/\D/g, '').slice(0, PIN_LENGTH))}
                      secureTextEntry={!showPin}
                      editable={!loading && !isLocked}
                      keyboardType="number-pad"
                      maxLength={PIN_LENGTH}
                      style={[styles.input, styles.pinInput, { color: inputTextColor }]}
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
                  <Text style={[styles.lockoutText, { color: colors.error }]}>
                    Try again in {lockoutMinsLeft} minute{lockoutMinsLeft !== 1 ? 's' : ''}
                  </Text>
                ) : (
                  <>
                    <Pressable
                      onPress={handleLogin}
                      disabled={loading}
                      style={({ pressed }) => [
                        styles.loginBtn,
                        { backgroundColor: themeYellow, opacity: loading ? 1 : pressed ? 0.9 : 1 },
                      ]}
                    >
                      {loading ? (
                        <>
                          <ActivityIndicator size="small" color="#09142f" />
                          <Text style={styles.loginBtnText}>Signing in…</Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.loginBtnText}>Sign in</Text>
                          <Ionicons name="arrow-forward" size={Icons.standard} color="#09142f" />
                        </>
                      )}
                    </Pressable>

                    {showBiometricSignIn ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Sign in with ${biometricLabel}`}
                        accessibilityState={{ busy: biometricLoading, disabled: biometricLoading }}
                        disabled={biometricLoading}
                        onPress={handleBiometricLogin}
                        style={({ pressed }) => [
                          styles.biometricBtn,
                          {
                            borderColor: isDark ? '#455471' : '#d5c59e',
                            backgroundColor: isDark ? '#1d2d49' : '#fff7e2',
                          },
                          pressed && styles.biometricBtnPressed,
                        ]}
                      >
                        {biometricLoading ? (
                          <ActivityIndicator size="small" color={accentColor} />
                        ) : (
                          <View style={styles.fingerprintFrame} accessible={false}>
                            <Ionicons
                              name="scan-outline"
                              size={40}
                              color={accentColor}
                              style={styles.fingerprintFrameCorners}
                            />
                            <Animated.View style={fingerprintPulseStyle}>
                              <Ionicons name="finger-print-outline" size={27} color={accentColor} />
                            </Animated.View>
                          </View>
                        )}
                      </Pressable>
                    ) : null}
                  </>
                )}
              </View>

              <View style={styles.footerGroup}>
                <View style={styles.utilityRow}>
                  <View style={styles.utilityItem}>
                    <Ionicons name="help-circle-outline" size={Icons.standard} color={titleColor} />
                    <Text style={[styles.utilityText, { color: titleColor }]}>Need help?</Text>
                  </View>
                  <View style={[styles.footerDivider, { backgroundColor: subtitleColor }]} />
                  <View style={styles.utilityItem}>
                    <Ionicons name="globe-outline" size={Icons.standard} color={titleColor} />
                    <Text style={[styles.utilityText, { color: titleColor }]}>English</Text>
                    <Ionicons name="chevron-down" size={Icons.small} color={accentColor} />
                  </View>
                </View>

                <View style={styles.footerTagline}>
                  <View style={styles.footerRule} />
                  <Text style={[styles.footerTaglineText, { color: subtitleColor }]}>
                    People <Text style={{ color: accentColor }}>•</Text> Technology{' '}
                    <Text style={{ color: accentColor }}>•</Text> Impact
                  </Text>
                  <View style={styles.footerRule} />
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
      <Modal
        visible={biometricPromptVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismissBiometricPrompt}
      >
        <View style={styles.biometricModalBackdrop}>
          <View
            style={[
              styles.biometricModalCard,
              {
                backgroundColor: isDark ? '#101a34' : '#fff',
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(17,24,39,0.1)',
              },
            ]}
          >
            <View style={styles.biometricModalIcon}>
              <Ionicons name={biometricIconName} size={32} color={themeYellow} />
            </View>
            <Text style={styles.biometricModalEyebrow}>QUICK &amp; SECURE ACCESS</Text>
            <Text style={[styles.biometricModalTitle, { color: titleColor }]}>Enable {biometricLabel}?</Text>
            <Text style={[styles.biometricModalMessage, { color: subtitleColor }]}>
              Use {biometricLabel.toLowerCase()} to sign in to Stagepass faster next time. Your biometric data stays on this device.
            </Text>
            {biometricPromptError ? (
              <View style={styles.biometricModalError}>
                <Ionicons name="alert-circle-outline" size={18} color={isDark ? '#ffd166' : '#9a5b00'} />
                <Text style={[styles.biometricModalErrorText, { color: isDark ? '#ffd166' : '#9a5b00' }]}>
                  {biometricPromptError}
                </Text>
              </View>
            ) : null}
            <View style={styles.biometricModalActions}>
              <Pressable
                onPress={dismissBiometricPrompt}
                disabled={biometricPromptBusy}
                style={({ pressed }) => [
                  styles.biometricModalSecondary,
                  {
                    borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(17,24,39,0.18)',
                    opacity: biometricPromptBusy ? 0.55 : pressed ? 0.72 : 1,
                  },
                ]}
              >
                <Text style={[styles.biometricModalSecondaryText, { color: titleColor }]}>Not now</Text>
              </Pressable>
              <Pressable
                onPress={enableBiometricFromPrompt}
                disabled={biometricPromptBusy}
                style={({ pressed }) => [styles.biometricModalPrimary, { opacity: biometricPromptBusy ? 0.8 : pressed ? 0.86 : 1 }]}
              >
                {biometricPromptBusy ? (
                  <ActivityIndicator size="small" color="#09142f" />
                ) : (
                  <Ionicons name="finger-print-outline" size={19} color="#09142f" />
                )}
                <Text style={styles.biometricModalPrimaryText}>
                  {biometricPromptBusy ? 'Enabling…' : 'Enable'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
  },
  keyboardWrap: { flex: 1 },
  keyboard: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 32,
  },
  content: {
    width: '100%',
    flexGrow: 1,
    maxWidth: 520,
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 40,
    marginBottom: Spacing.md,
  },
  headerSpacer: { flex: 1 },
  themeBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'rgba(7,15,35,0.52)',
  },
  biometricModalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    backgroundColor: 'rgba(3,8,22,0.72)',
  },
  biometricModalCard: {
    width: '100%',
    maxWidth: 390,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderRadius: 26,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 18,
  },
  biometricModalIcon: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 34,
    backgroundColor: 'rgba(255,194,0,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,194,0,0.28)',
    marginBottom: Spacing.md,
  },
  biometricModalEyebrow: {
    color: themeYellow,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: Spacing.xs,
  },
  biometricModalTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  biometricModalMessage: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  biometricModalError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    width: '100%',
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(255,194,0,0.08)',
  },
  biometricModalErrorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  biometricModalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
    marginTop: Spacing.xl,
  },
  biometricModalSecondary: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
  },
  biometricModalSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
  },
  biometricModalPrimary: {
    flex: 1,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: 14,
    backgroundColor: themeYellow,
  },
  biometricModalPrimaryText: {
    color: '#09142f',
    fontSize: 15,
    fontWeight: '800',
  },
  brandBlock: {
    gap: Spacing.sm,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  crewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  crewRule: {
    width: 30,
    height: 2,
    backgroundColor: themeYellow,
  },
  crewLabel: {
    color: themeYellow,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  card: {
    padding: Spacing.xl,
    borderRadius: 22,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.45,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: Spacing.xl,
  },
  fieldGroup: { marginBottom: Spacing.md },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  pinLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  forgotLink: {
    fontSize: 15,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 15,
    minHeight: 52,
  },
  inputIcon: { marginLeft: Spacing.lg },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  pinInput: { letterSpacing: 4 },
  pinToggleBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  lockoutText: {
    textAlign: 'center',
    marginTop: Spacing.lg,
    fontSize: 14,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    minHeight: 54,
    borderRadius: 16,
  },
  loginBtnText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#09142f',
  },
  biometricBtn: {
    alignSelf: 'center',
    width: 58,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    borderWidth: 1,
    borderRadius: 17,
  },
  biometricBtnPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.86,
  },
  fingerprintFrame: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fingerprintFrameCorners: {
    position: 'absolute',
    opacity: 0.5,
  },
  footerGroup: {
    marginTop: 'auto',
    paddingTop: Spacing.xl,
  },
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginTop: 0,
  },
  utilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  utilityText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footerDivider: {
    width: 1,
    height: 24,
    opacity: 0.5,
  },
  footerTagline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  footerRule: {
    width: 24,
    height: 1.5,
    backgroundColor: themeYellow,
  },
  footerTaglineText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
});
