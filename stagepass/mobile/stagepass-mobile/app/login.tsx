/**
 * Login (landing) screen – proportional, elegant, trustworthy.
 * Uses a consistent scale and restrained palette for credibility.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useDispatch } from 'react-redux';
import { api, getApiBase, setAuthToken } from '~/services/api';
import { setCredentials } from '~/store/authSlice';
import { getLoginLockoutUntil, saveToken, setLoginLockoutUntil } from '~/store/persistAuth';
import { AnimatedGradientLogo } from '@/components/AnimatedGradientLogo';
import { StagepassLoader } from '@/components/StagepassLoader';
import { StagePassButton } from '@/components/StagePassButton';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, themeBlue, themeBlueLight, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

/* Proportional scale: base 4 → 8, 12, 16, 20, 24, 32, 40, 48, 56 */
const U = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
  hero: 40,
  cardPad: 28,
  inputH: 52,
  btnH: 52,
};
const CARD_RADIUS = 20;
const BORDER_WIDTH = 1;

const PIN_LENGTH = 4;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const dispatch = useDispatch();
  const router = useRouter();
  const { colors, isDark } = useStagePassTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getLoginLockoutUntil().then((until) => {
      if (until && until > Date.now()) setLockoutUntil(until);
      else setLockoutUntil(null);
    });
  }, []);

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
      const res = await api.auth.login(trimmedUser, pin);
      if (__DEV__) {
        console.warn('[Login] Success, token received');
      }
      setAuthToken(res.token);
      await saveToken(res.token);
      dispatch(setCredentials({ user: res.user, token: res.token }));
      setFailedAttempts(0);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      if (__DEV__) {
        console.warn('[Login] Error', e);
      }
      const message = e instanceof Error ? e.message : 'Invalid username or PIN.';
      const isNetworkError =
        message === 'Network request failed' ||
        message.toLowerCase().includes('network') ||
        (e instanceof TypeError && (e.message === 'Network request failed' || e.message.includes('fetch')));
      if (isNetworkError) {
        const base = getApiBase();
        Alert.alert(
          'Connection failed',
          `Cannot reach: ${base}\n\n` +
            '1. Start the API: cd backend/laravel-api && php artisan serve --host=0.0.0.0\n' +
            '2. Ensure your phone and PC are on the same network (or use the PC IP that matches your Wi‑Fi).\n' +
            '3. Tap Retry after the server is running.',
          [
            { text: 'OK' },
            { text: 'Retry', onPress: () => handleLogin() },
          ]
        );
      } else {
        const next = failedAttempts + 1;
        setFailedAttempts(next);
        if (next >= MAX_FAILED_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
          await setLoginLockoutUntil(until);
          setLockoutUntil(until);
          Alert.alert(
            'Account locked',
            `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`
          );
        } else {
          Alert.alert('Login failed', message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const cardBg = isDark ? colors.surface : '#FFFFFF';
  const inputBg = colors.inputBackground;
  const inputBorder = colors.inputBorder;
  const placeholderColor = colors.placeholder;
  const bgStart = isDark ? themeBlue + '12' : themeBlueLight;
  const bgEnd = colors.background;

  return (
    <View style={styles.container}>
      {loading && <StagepassLoader message="Signing in…" fullScreen />}
      <LinearGradient
        colors={[bgStart, bgEnd]}
        locations={[0, 0.5]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + U.section,
              paddingBottom: insets.bottom + U.xxl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero: logo – proportional spacing */}
          <Animated.View entering={FadeIn.duration(500)} style={styles.hero}>
            <View style={styles.logoWrap}>
              <AnimatedGradientLogo innerBackgroundColor={cardBg} />
            </View>
          </Animated.View>

          {/* Card: sign-in form */}
          <Animated.View
            entering={FadeInDown.delay(120).duration(450).springify().damping(16)}
            style={[styles.cardWrap, { borderColor: colors.border, backgroundColor: cardBg }]}
          >
            <View style={styles.card}>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>
                Sign in
              </ThemedText>
              <View style={[styles.titleUnderline, { backgroundColor: themeYellow }]} />
              <ThemedText style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                Use your username or Staff ID and PIN
              </ThemedText>

              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Username or Staff ID
                </ThemedText>
                <StagePassInput
                  placeholder="Enter username or Staff ID"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading && !isLocked}
                  autoComplete="username"
                  style={[styles.input, { borderColor: inputBorder, borderWidth: BORDER_WIDTH, minHeight: U.inputH }]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  PIN
                </ThemedText>
                <View style={[styles.pinWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                  <TextInput
                    style={[styles.pinInput, { color: colors.text }]}
                    placeholder={`${PIN_LENGTH}-digit PIN`}
                    placeholderTextColor={placeholderColor}
                    value={pin}
                    onChangeText={(text) => setPin(text.replace(/\D/g, '').slice(0, PIN_LENGTH))}
                    secureTextEntry
                    editable={!loading && !isLocked}
                    keyboardType="number-pad"
                    maxLength={PIN_LENGTH}
                  />
                  <View style={styles.pinIcon}>
                    <Ionicons name="keypad-outline" size={20} color={themeYellow} />
                  </View>
                </View>
              </View>

              {isLocked ? (
                <View style={styles.lockoutWrap}>
                  <Ionicons name="lock-closed" size={16} color={colors.error} />
                  <ThemedText style={[styles.lockoutText, { color: colors.error }]}>
                    Try again in {lockoutMinsLeft} minute{lockoutMinsLeft !== 1 ? 's' : ''}
                  </ThemedText>
                </View>
              ) : (
                <StagePassButton
                  title={loading ? 'Signing in…' : 'Sign in'}
                  onPress={handleLogin}
                  loading={loading}
                  disabled={loading}
                  style={styles.submitButton}
                />
              )}

              <View style={styles.secureRow}>
                <Ionicons name="shield-checkmark" size={14} color={colors.textSecondary} />
                <ThemedText style={[styles.secureText, { color: colors.textSecondary }]}>
                  Secure sign in
                </ThemedText>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: U.xl,
    paddingVertical: U.section,
    paddingBottom: U.section * 2,
  },
  hero: {
    alignItems: 'center',
    marginBottom: U.hero,
  },
  logoWrap: {
    shadowColor: themeBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  cardWrap: {
    borderRadius: CARD_RADIUS,
    borderWidth: BORDER_WIDTH,
    overflow: 'hidden',
    shadowColor: themeBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  card: {
    padding: U.cardPad,
    borderRadius: CARD_RADIUS,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: U.sm,
  },
  titleUnderline: {
    width: 40,
    height: 3,
    borderRadius: 2,
    marginBottom: U.lg,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: U.xxl,
    opacity: 0.9,
  },
  fieldGroup: {
    marginBottom: U.xl,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: U.sm,
  },
  input: {
    borderRadius: BorderRadius.lg,
    fontSize: 16,
  },
  pinWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: BORDER_WIDTH,
    borderRadius: BorderRadius.lg,
    minHeight: U.inputH,
  },
  pinInput: {
    flex: 1,
    fontSize: 16,
    letterSpacing: 8,
    paddingHorizontal: U.lg,
    paddingVertical: U.md,
  },
  pinIcon: {
    padding: U.lg,
  },
  submitButton: {
    marginTop: U.md,
    backgroundColor: themeYellow,
    paddingVertical: U.lg,
    minHeight: U.btnH,
    borderRadius: BorderRadius.lg,
    borderWidth: BORDER_WIDTH,
    borderColor: themeBlue,
  },
  lockoutWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: U.sm,
    marginTop: U.lg,
    paddingVertical: U.md,
  },
  lockoutText: {
    fontSize: 14,
    fontWeight: '600',
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: U.sm,
    marginTop: U.xl,
  },
  secureText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
