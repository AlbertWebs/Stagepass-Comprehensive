/** Forgot PIN recovery screen, styled to match the login screen. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { StagepassText as Text } from '@/components/StagepassText';
import { StagepassTextInput as TextInput } from '@/components/StagepassTextInput';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '~/services/api';
import { StagepassFaviconLogo } from '@/components/StagepassFaviconLogo';
import { useThemePreference } from '@/context/ThemePreferenceContext';
import { Icons } from '@/constants/ui';
import { Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { NAV_PRESSED_OPACITY, useNavigationPress } from '@/src/utils/navigationPress';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const router = useRouter();
  const handleNav = useNavigationPress();
  const { colors, isDark } = useStagePassTheme();
  const { setPreference } = useThemePreference();
  const insets = useSafeAreaInsets();
  const exitOpacity = useSharedValue(1);
  const exitTranslateY = useSharedValue(0);

  const bgColor = isDark ? themeBlue : '#f2f4f8';
  const titleColor = isDark ? '#fff' : '#111a31';
  const subtitleColor = isDark ? '#d7dced' : '#596276';
  const inputBg = isDark ? 'rgba(255,255,255,0.08)' : '#ffffff';
  const inputBorder = isDark ? 'rgba(195,205,229,0.55)' : 'rgba(17,24,39,0.18)';

  const exitAnimatedStyle = useAnimatedStyle(() => ({
    opacity: exitOpacity.value,
    transform: [{ translateY: exitTranslateY.value }],
  }));
  const toggleTheme = (x: number, y: number) => {
    const nextPreference = isDark ? 'light' : 'dark';
    setPreference(nextPreference, {
      origin: { x, y },
      color: nextPreference === 'dark' ? themeBlue : '#f2f4f8',
    });
  };

  const goToLogin = () => {
    exitOpacity.value = withTiming(0, { duration: 280 }, (finished) => {
      if (finished) runOnJS(router.replace)('/login');
    });
    exitTranslateY.value = withTiming(-10, { duration: 280 });
  };

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Email required', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    setSent(false);
    try {
      await api.auth.forgotPassword(trimmed);
      setSent(true);
    } catch (error: unknown) {
      Alert.alert(
        'Request failed',
        error instanceof Error ? error.message : 'Could not send reset link. Try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Image
        source={require('../assets/images/login-unbranded-crew.webp')}
        contentFit="cover"
        contentPosition="left center"
        style={styles.heroBackdrop}
      />
      <LinearGradient
        colors={['rgba(5,10,28,0.3)', 'rgba(7,20,47,0.82)', bgColor]}
        locations={[0, 0.62, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.heroGradient}
      />
      <Animated.View style={[styles.keyboardWrap, exitAnimatedStyle]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.xl },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <View style={styles.headerRow}>
                <Pressable
                  onPress={() => handleNav(() => router.back())}
                  accessibilityRole="button"
                  accessibilityLabel="Back to login"
                  style={({ pressed }) => [styles.headerButton, { opacity: pressed ? NAV_PRESSED_OPACITY : 1 }]}
                >
                  <Ionicons name="arrow-back" size={Icons.standard} color="#fff" />
                </Pressable>
                <View style={styles.headerSpacer} />
                <Pressable
                  onPress={(event) => toggleTheme(event.nativeEvent.pageX, event.nativeEvent.pageY)}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} appearance`}
                  style={({ pressed }) => [styles.themeBtn, { opacity: pressed ? NAV_PRESSED_OPACITY : 1 }]}
                >
                  <Ionicons name={isDark ? 'moon' : 'sunny'} size={Icons.standard} color="#fff" />
                </Pressable>
              </View>

              <View style={styles.brandBlock}>
                <View style={styles.logoIconWrap}>
                  <StagepassFaviconLogo size={46} />
                </View>
                <View style={styles.crewRow}>
                  <View style={styles.crewRule} />
                  <Text style={styles.crewLabel}>CREW</Text>
                  <View style={styles.crewRule} />
                </View>
              </View>

              <View style={styles.card}>
                <Text style={[styles.welcomeTitle, { color: titleColor }]}>
                  {sent ? 'Check your email' : 'Forgot PIN?'}
                </Text>
                <Text style={[styles.welcomeSubtitle, { color: subtitleColor }]}>
                  {sent
                    ? `If an account exists for ${email.trim()}, we’ve sent a reset link. Check your inbox and spam folder.`
                    : "Enter your email and we'll send you a link to reset your PIN."}
                </Text>

                {!sent ? (
                  <>
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.fieldLabel, { color: titleColor }]}>Email</Text>
                      <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                        <Ionicons name="mail-outline" size={Icons.standard} color={themeYellow} style={styles.inputIcon} />
                        <TextInput
                          placeholder="Enter your email"
                          placeholderTextColor={isDark ? '#aab3c9' : '#8991a1'}
                          value={email}
                          onChangeText={setEmail}
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={!loading}
                          autoComplete="email"
                          keyboardType="email-address"
                          style={[styles.input, { color: titleColor }]}
                        />
                      </View>
                    </View>
                    <Pressable
                      onPress={handleSubmit}
                      disabled={loading}
                      style={({ pressed }) => [
                        styles.loginBtn,
                        { opacity: loading ? 0.72 : pressed ? 0.9 : 1 },
                      ]}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#09142f" />
                      ) : (
                        <>
                          <Text style={styles.loginBtnText}>Send reset link</Text>
                          <Ionicons name="arrow-forward" size={Icons.standard} color="#09142f" />
                        </>
                      )}
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={goToLogin}
                    style={({ pressed }) => [styles.loginBtn, { opacity: pressed ? 0.9 : 1 }]}
                  >
                    <Text style={styles.loginBtnText}>Back to login</Text>
                    <Ionicons name="arrow-forward" size={Icons.standard} color="#09142f" />
                  </Pressable>
                )}

                {!sent && (
                  <View style={styles.rememberRow}>
                    <Text style={[styles.rememberText, { color: subtitleColor }]}>Remember your PIN?</Text>
                    <Pressable
                      onPress={goToLogin}
                      hitSlop={8}
                      style={({ pressed }) => ({ opacity: pressed ? NAV_PRESSED_OPACITY : 1 })}
                    >
                      <Text style={styles.rememberLink}>Back to login</Text>
                    </Pressable>
                  </View>
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
                    <Ionicons name="chevron-down" size={Icons.small} color={themeYellow} />
                  </View>
                </View>
                <View style={styles.footerTagline}>
                  <View style={styles.footerRule} />
                  <Text style={[styles.footerTaglineText, { color: subtitleColor }]}>People <Text style={{ color: themeYellow }}>•</Text> Technology <Text style={{ color: themeYellow }}>•</Text> Impact</Text>
                  <View style={styles.footerRule} />
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroBackdrop: { position: 'absolute', top: 0, left: 0, width: '150%', height: 440 },
  heroGradient: { position: 'absolute', top: 0, left: 0, width: '150%', height: 440 },
  keyboardWrap: { flex: 1 },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.lg },
  content: { width: '100%', flexGrow: 1, maxWidth: 520, alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 42, marginBottom: Spacing.md },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'rgba(7,15,35,0.52)',
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
  brandBlock: { alignItems: 'center', marginTop: 156, marginBottom: Spacing.lg },
  logoIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  crewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, marginTop: Spacing.md },
  crewRule: { width: 30, height: 2, backgroundColor: themeYellow },
  crewLabel: { color: themeYellow, fontSize: 20, fontWeight: '800', letterSpacing: 1.4 },
  card: { padding: 0 },
  welcomeTitle: { fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: -0.45, marginBottom: 4 },
  welcomeSubtitle: { fontSize: 15, lineHeight: 18, textAlign: 'center', marginBottom: Spacing.lg },
  fieldGroup: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 15, minHeight: 60 },
  inputIcon: { marginLeft: Spacing.lg },
  input: { flex: 1, fontSize: 16, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    minHeight: 62,
    borderRadius: 16,
    backgroundColor: themeYellow,
  },
  loginBtnText: { fontSize: 20, fontWeight: '800', color: '#09142f' },
  rememberRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.lg },
  rememberText: { fontSize: 14 },
  rememberLink: { color: themeYellow, fontSize: 14, fontWeight: '700' },
  footerGroup: { marginTop: 'auto' },
  utilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  utilityItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  utilityText: { fontSize: 14, fontWeight: '500' },
  footerDivider: { width: 1, height: 24, opacity: 0.5 },
  footerTagline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.lg },
  footerRule: { width: 24, height: 1.5, backgroundColor: themeYellow },
  footerTaglineText: { fontSize: 11, fontWeight: '600', letterSpacing: 1.2 },
});
