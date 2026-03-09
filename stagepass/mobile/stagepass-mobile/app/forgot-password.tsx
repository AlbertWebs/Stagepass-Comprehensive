import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '~/services/api';
import { StagePassButton } from '@/components/StagePassButton';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

const CARD_RADIUS = 24;

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const { colors, isDark } = useStagePassTheme();
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

  const cardBg = isDark ? colors.surface : colors.surfaceElevated;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + Spacing.section,
              paddingBottom: insets.bottom + Spacing.section * 2,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}
            accessibilityLabel="Back to login"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={themeYellow} />
            <ThemedText style={[styles.backLabel, { color: themeYellow }]}>Back to login</ThemedText>
          </Pressable>

          <ThemedText style={[styles.title, { color: themeYellow }]}>Forgot password?</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter your email and we'll send you a link to reset your password.
          </ThemedText>

          <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
            <View style={[styles.cardAccent, { backgroundColor: themeYellow }]} />

            {sent ? (
              <View style={styles.successBlock}>
                <View style={[styles.successIconWrap, { backgroundColor: colors.success + '20' }]}>
                  <Ionicons name="mail-open-outline" size={40} color={colors.success} />
                </View>
                <ThemedText style={[styles.successTitle, { color: colors.text }]}>
                  Check your email
                </ThemedText>
                <ThemedText style={[styles.successText, { color: colors.textSecondary }]}>
                  If an account exists for {email.trim()}, we've sent a password reset link. Check your
                  inbox and spam folder.
                </ThemedText>
                <StagePassButton
                  title="Back to login"
                  onPress={() => router.replace('/login')}
                  style={[styles.button, { backgroundColor: themeYellow }]}
                />
              </View>
            ) : (
              <>
                <StagePassInput
                  placeholder="Email address"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                  autoComplete="email"
                  style={styles.input}
                />
                <StagePassButton
                  title={loading ? 'Sending…' : 'Send reset link'}
                  onPress={handleSubmit}
                  loading={loading}
                  disabled={loading}
                  style={[styles.button, { backgroundColor: themeYellow }]}
                />
              </>
            )}
          </View>
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
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.section,
    paddingBottom: Spacing.section * 2,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  backLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: Spacing.sm,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    padding: Spacing.xxl,
    paddingTop: Spacing.xxl + 8,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  input: {
    marginBottom: Spacing.xl,
  },
  button: {
    marginTop: Spacing.sm,
  },
  successBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: Spacing.xl,
  },
});
