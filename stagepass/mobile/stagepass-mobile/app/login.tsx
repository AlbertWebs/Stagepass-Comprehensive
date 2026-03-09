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
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

const CARD_SHADOW = { width: 0, height: 6 };
const CARD_RADIUS = 24;
const GRADIENT_BORDER_WIDTH = 2;

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

  const cardBg = isDark ? colors.surface : colors.surfaceElevated;
  const inputBg = colors.inputBackground;
  const inputBorder = colors.inputBorder;
  const placeholderColor = colors.placeholder;

  return (
    <ThemedView style={styles.container}>
      {loading && <StagepassLoader message="Signing in…" fullScreen />}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              backgroundColor: colors.background,
              paddingTop: insets.top + Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xxl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <AnimatedGradientLogo innerBackgroundColor={cardBg} />
            <Animated.Text
              entering={FadeIn.delay(100).duration(600)}
              style={[styles.brandName, { color: colors.text }]}
            >
              Stagepass AV
            </Animated.Text>
            <ThemedText style={[styles.tagline, { color: colors.textSecondary }]}>
              Creative Solutions · Technical Excellence
            </ThemedText>
          </View>

          <Animated.View
            entering={FadeInDown.delay(200).duration(400).springify()}
            style={styles.cardGradientWrap}
          >
            <LinearGradient
              colors={[themeBlue, themeYellow, themeBlue]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.cardGradientBorder, { borderRadius: CARD_RADIUS + GRADIENT_BORDER_WIDTH }]}
            >
              <View style={[styles.card, { backgroundColor: cardBg }]}>
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Sign in</ThemedText>
            <ThemedText style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
              Use your username or Staff ID and PIN
            </ThemedText>

            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Username or Staff ID
            </ThemedText>
            <StagePassInput
              placeholder="Username or Staff ID"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading && !isLocked}
              autoComplete="username"
              style={styles.input}
            />

            <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>PIN</ThemedText>
            <View style={[styles.pinWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <TextInput
                style={[styles.pinInput, { color: colors.text }]}
                placeholder={`${PIN_LENGTH} digits`}
                placeholderTextColor={placeholderColor}
                value={pin}
                onChangeText={(text) => setPin(text.replace(/\D/g, '').slice(0, PIN_LENGTH))}
                secureTextEntry
                editable={!loading && !isLocked}
                keyboardType="number-pad"
                maxLength={PIN_LENGTH}
              />
              <View style={styles.pinIcon}>
                <Ionicons name="keypad-outline" size={20} color={colors.textSecondary} />
              </View>
            </View>

            {isLocked ? (
              <ThemedText style={[styles.lockoutText, { color: colors.error }]}>
                Account locked. Try again in {lockoutMinsLeft} minute{lockoutMinsLeft !== 1 ? 's' : ''}.
              </ThemedText>
            ) : (
              <StagePassButton
                title={loading ? 'Signing in…' : 'Sign in'}
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                style={[styles.button, { backgroundColor: themeYellow }]}
              />
            )}
              </View>
            </LinearGradient>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
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
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.section * 1.5,
    paddingBottom: Spacing.section * 2,
  },
  hero: {
    alignItems: 'center',
    marginBottom: Spacing.xxl + 4,
  },
  brandName: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: 14,
    letterSpacing: 0.3,
  },
  cardGradientWrap: {
    shadowColor: '#000',
    shadowOffset: CARD_SHADOW,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  cardGradientBorder: {
    padding: GRADIENT_BORDER_WIDTH,
  },
  card: {
    borderRadius: CARD_RADIUS,
    padding: Spacing.xxl,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: Spacing.xs,
  },
  cardSubtitle: {
    fontSize: 15,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  input: {
    marginBottom: Spacing.lg,
  },
  pinWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    marginBottom: Spacing.xl,
    minHeight: 52,
  },
  pinInput: {
    flex: 1,
    fontSize: 18,
    letterSpacing: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  pinIcon: {
    padding: Spacing.md,
    marginRight: Spacing.xs,
  },
  button: {
    marginTop: Spacing.xs,
  },
  lockoutText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
