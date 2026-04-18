/**
 * Forgot password (PIN reset) – matches login page design.
 * Same background, logo, card, input style, button and footer as login.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '~/services/api';
import { StagepassFaviconLogo } from '@/components/StagepassFaviconLogo';
import { ThemedText } from '@/components/themed-text';
import { useThemePreference } from '@/context/ThemePreferenceContext';
import { BEVEL_PRIMARY, BUTTON_3D_PRESSED, BUTTON_3D_SHADOW } from '@/constants/button3d';
import { themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

const U = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 32 };
const CARD_RADIUS = 20;
const INPUT_RADIUS = 12;

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const { colors, isDark } = useStagePassTheme();
  const { setPreference } = useThemePreference();
  const insets = useSafeAreaInsets();

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
    } catch (e: unknown) {
      Alert.alert(
        'Request failed',
        e instanceof Error ? e.message : 'Could not send reset link. Try again.'
      );
    } finally {
      setLoading(false);
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
          {/* Back + theme toggle – same header row as login */}
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
              accessibilityLabel="Back to login"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : colors.text} />
            </Pressable>
            <Pressable onPress={toggleTheme} style={({ pressed }) => [styles.themeBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons
                name={isDark ? 'moon' : 'sunny'}
                size={24}
                color={isDark ? '#fff' : colors.text}
              />
            </Pressable>
          </View>

          {/* Logo + wordmark – same as login */}
          <View style={styles.logoSection}>
            <View style={styles.logoIconWrap}>
              <StagepassFaviconLogo size={64} />
            </View>
            <ThemedText style={[styles.wordmark, { color: isDark ? '#fff' : colors.text }]}>
              Stagepass Crew
            </ThemedText>
          </View>

          {/* Form card – same structure as login */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
            <ThemedText style={[styles.welcomeTitle, { color: titleColor }]}>
              {sent ? 'Check your email' : 'Forgot PIN?'}
            </ThemedText>
            <ThemedText style={[styles.welcomeSubtitle, { color: subtitleColor }]}>
              {sent
                ? `If an account exists for ${email.trim()}, we've sent a reset link. Check your inbox and spam folder.`
                : "Enter your email and we'll send you a link to reset your PIN."}
            </ThemedText>

            {sent ? (
              <Pressable
                onPress={() => router.replace('/login')}
                style={({ pressed }) => [
                  styles.loginBtn,
                  BUTTON_3D_SHADOW,
                  BEVEL_PRIMARY,
                  { backgroundColor: accentColor, opacity: pressed ? 0.9 : 1 },
                  pressed && [BUTTON_3D_PRESSED, { transform: [{ scale: 0.985 }] }],
                ]}
              >
                <ThemedText style={styles.loginBtnText}>Back to login</ThemedText>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </Pressable>
            ) : (
              <>
                <View style={styles.fieldGroup}>
                  <ThemedText style={[styles.fieldLabel, { color: subtitleColor }]}>Email</ThemedText>
                  <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <Ionicons name="mail-outline" size={20} color={accentColor} style={styles.inputIcon} />
                    <TextInput
                      placeholder="Enter your email"
                      placeholderTextColor={colors.placeholder}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      autoComplete="email"
                      keyboardType="email-address"
                      style={[styles.input, { color: colors.text }]}
                    />
                  </View>
                </View>

                <Pressable
                  onPress={handleSubmit}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.loginBtn,
                    BUTTON_3D_SHADOW,
                    BEVEL_PRIMARY,
                    { backgroundColor: accentColor, opacity: loading ? 0.7 : pressed ? 0.9 : 1 },
                    !loading && pressed && [BUTTON_3D_PRESSED, { transform: [{ scale: 0.985 }] }],
                  ]}
                >
                  <ThemedText style={styles.loginBtnText}>
                    {loading ? 'Sending…' : 'Send reset link'}
                  </ThemedText>
                  {!loading && <Ionicons name="arrow-forward" size={20} color="#fff" />}
                </Pressable>
              </>
            )}
          </View>

          {/* Footer – same as login */}
          <View style={styles.footer}>
            <ThemedText style={[styles.footerText, { color: subtitleColor }]}>Remember your PIN?</ThemedText>
            <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <ThemedText style={[styles.footerLink, { color: accentColor }]}>Back to login</ThemedText>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  logoIconWrap: { marginBottom: U.md },
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
