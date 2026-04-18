/**
 * First-run setup: requests permissions the app relies on (location, notifications, camera/photos).
 * Finishes with a single "Get started" handoff to login or home when a session already exists.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import {
  AndroidImportance,
  getPermissionsAsync as getNotificationPermissionsAsync,
  requestPermissionsAsync as requestNotificationPermissionsAsync,
  setNotificationChannelAsync,
} from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import { StagepassFaviconLogo } from '@/components/StagepassFaviconLogo';
import { StagePassButton } from '@/components/StagePassButton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { setOnboardingState } from '~/store/appSlice';
import { setOnboardingComplete as persistOnboardingComplete } from '~/store/onboardingPrefs';
import type { RootState } from '~/store';

const STEP_COUNT = 4;
const ALLOW_SUCCESS_MS = 920;

function AnimatedAllowConfirmation({
  message,
  successColor,
  textColor,
}: {
  message: string;
  successColor: string;
  textColor: string;
}) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.08, { damping: 12, stiffness: 260 }),
      withSpring(1, { damping: 16, stiffness: 320 })
    );
  }, [scale]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.successBlock} accessibilityLiveRegion="polite">
      <Animated.View
        style={[
          styles.checkRing,
          { borderColor: successColor, backgroundColor: `${successColor}18` },
          ringStyle,
        ]}
      >
        <Ionicons name="checkmark" size={36} color={successColor} />
      </Animated.View>
      <Animated.View entering={FadeIn.duration(260).delay(100)}>
        <ThemedText style={[styles.successMessage, { color: textColor }]}>{message}</ThemedText>
      </Animated.View>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { colors, radius, spacing } = useStagePassTheme();
  const token = useSelector((s: RootState) => s.auth.token);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [allowFeedback, setAllowFeedback] = useState<{ message: string } | null>(null);

  useEffect(() => {
    setAllowFeedback(null);
  }, [step]);

  const goNext = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  }, []);

  const goBack = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      await persistOnboardingComplete(true);
      dispatch(setOnboardingState({ onboardingComplete: true }));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (token) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    } finally {
      setBusy(false);
    }
  }, [dispatch, router, token]);

  const afterAllow = useCallback(
    (granted: boolean, successMessage: string, advance: () => void) => {
      setBusy(false);
      if (granted) {
        setAllowFeedback({ message: successMessage });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          setAllowFeedback(null);
          advance();
        }, ALLOW_SUCCESS_MS);
      } else {
        setTimeout(advance, 340);
      }
    },
    []
  );

  const requestLocation = useCallback(async () => {
    setBusy(true);
    try {
      let granted = Platform.OS === 'web';
      if (Platform.OS !== 'web') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        granted = status === 'granted';
      }
      afterAllow(granted, 'Location access is on', goNext);
    } catch {
      setBusy(false);
      goNext();
    }
  }, [afterAllow, goNext]);

  const requestNotifications = useCallback(async () => {
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        afterAllow(true, 'Ready for the next step', goNext);
        return;
      }
      if (isRunningInExpoGo() || Constants.appOwnership === 'expo') {
        afterAllow(true, 'Setup saved', goNext);
        return;
      }
      try {
        if (Platform.OS === 'android') {
          await setNotificationChannelAsync('default', {
            name: 'Default',
            importance: AndroidImportance.DEFAULT,
          });
        }
        const { status: before } = await getNotificationPermissionsAsync();
        if (before !== 'granted') {
          await requestNotificationPermissionsAsync();
        }
        const { status } = await getNotificationPermissionsAsync();
        const granted = status === 'granted';
        afterAllow(granted, 'Notifications are on', goNext);
      } catch {
        setBusy(false);
        goNext();
      }
    } finally {
      setBusy(false);
    }
  }, [afterAllow, goNext]);

  const requestPhotosAndFinish = useCallback(async () => {
    setBusy(true);
    try {
      let granted = Platform.OS === 'web';
      if (Platform.OS !== 'web') {
        const ImagePicker = await import('expo-image-picker');
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
        granted = cam.status === 'granted' || lib.status === 'granted';
      }
      afterAllow(granted, 'Camera and photo access updated', () => {
        void finish();
      });
    } catch {
      setBusy(false);
      void finish();
    }
  }, [afterAllow, finish]);

  const skipPhotosAndFinish = useCallback(async () => {
    await finish();
  }, [finish]);

  const renderDots = () => (
    <View style={styles.dotsRow}>
      {Array.from({ length: STEP_COUNT }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i === step ? colors.tint : colors.border,
              width: i === step ? 22 : 8,
            },
          ]}
        />
      ))}
    </View>
  );

  const onFooterNext = useCallback(() => {
    if (step >= STEP_COUNT - 1) {
      void finish();
      return;
    }
    goNext();
  }, [step, finish, goNext]);

  const canGoBack = step > 0;
  const isLastStep = step === STEP_COUNT - 1;
  const interactionLocked = busy || allowFeedback !== null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={[styles.scroll, { paddingBottom: spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderDots()}

        <Animated.View key={step} entering={SlideInRight.duration(280)} style={styles.cardWrap}>
          <Animated.View entering={FadeIn.duration(220)} style={[styles.card, { borderRadius: radius.lg, borderColor: colors.border, backgroundColor: colors.surface }]}>
            {step === 0 && (
              <>
                <View style={styles.logoRow}>
                  <StagepassFaviconLogo size={56} />
                </View>
                <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
                  Welcome to Stagepass
                </ThemedText>
                <ThemedText style={[styles.body, { color: colors.textSecondary }]}>
                  A quick setup helps check-ins, alerts, and your profile work smoothly. You can change
                  permissions anytime in system settings.
                </ThemedText>
              </>
            )}

            {step === 1 && (
              <>
                <View style={[styles.iconCircle, { backgroundColor: colors.surfaceElevated }]}>
                  <Ionicons name="location" size={40} color={colors.tint} />
                </View>
                <ThemedText type="subtitle" style={[styles.title, { color: colors.text }]}>
                  Location
                </ThemedText>
                <ThemedText style={[styles.body, { color: colors.textSecondary }]}>
                  We use your location to confirm you are at the venue for geofence check-in and related
                  event features.
                </ThemedText>
                {allowFeedback ? (
                  <AnimatedAllowConfirmation
                    message={allowFeedback.message}
                    successColor={colors.success}
                    textColor={colors.text}
                  />
                ) : (
                  <>
                    <StagePassButton title="Allow location access" onPress={requestLocation} loading={busy} />
                    <Pressable
                      onPress={goNext}
                      style={styles.textBtn}
                      hitSlop={12}
                      disabled={interactionLocked}
                    >
                      <ThemedText style={{ color: colors.textSecondary, fontSize: 15 }}>Not now</ThemedText>
                    </Pressable>
                  </>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <View style={[styles.iconCircle, { backgroundColor: colors.surfaceElevated }]}>
                  <Ionicons name="notifications" size={40} color={colors.tint} />
                </View>
                <ThemedText type="subtitle" style={[styles.title, { color: colors.text }]}>
                  Notifications
                </ThemedText>
                <ThemedText style={[styles.body, { color: colors.textSecondary }]}>
                  Stay informed about shifts, messages, and event updates. You can fine-tune alerts in
                  settings later.
                </ThemedText>
                {allowFeedback ? (
                  <AnimatedAllowConfirmation
                    message={allowFeedback.message}
                    successColor={colors.success}
                    textColor={colors.text}
                  />
                ) : (
                  <>
                    <StagePassButton title="Allow notifications" onPress={requestNotifications} loading={busy} />
                    <Pressable
                      onPress={goNext}
                      style={styles.textBtn}
                      hitSlop={12}
                      disabled={interactionLocked}
                    >
                      <ThemedText style={{ color: colors.textSecondary, fontSize: 15 }}>Not now</ThemedText>
                    </Pressable>
                  </>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <View style={[styles.iconCircle, { backgroundColor: colors.surfaceElevated }]}>
                  <Ionicons name="camera" size={40} color={colors.tint} />
                </View>
                <ThemedText type="subtitle" style={[styles.title, { color: colors.text }]}>
                  Camera and photos
                </ThemedText>
                <ThemedText style={[styles.body, { color: colors.textSecondary }]}>
                  Optional: allow camera and library access when you add or update your profile photo.
                </ThemedText>
                {allowFeedback ? (
                  <AnimatedAllowConfirmation
                    message={allowFeedback.message}
                    successColor={colors.success}
                    textColor={colors.text}
                  />
                ) : (
                  <>
                    <StagePassButton
                      title="Allow camera and photos"
                      onPress={requestPhotosAndFinish}
                      loading={busy}
                    />
                    <Pressable
                      onPress={skipPhotosAndFinish}
                      style={styles.textBtn}
                      hitSlop={12}
                      disabled={interactionLocked}
                    >
                      <ThemedText style={{ color: colors.textSecondary, fontSize: 15 }}>Skip for now</ThemedText>
                    </Pressable>
                  </>
                )}
              </>
            )}
          </Animated.View>
        </Animated.View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, spacing.md),
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        <Pressable
          onPress={goBack}
          disabled={!canGoBack || interactionLocked}
          style={[styles.footerBtn, (!canGoBack || interactionLocked) && styles.footerBtnDisabled]}
          hitSlop={8}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={canGoBack && !interactionLocked ? colors.text : colors.textSecondary}
          />
          <ThemedText
            style={[
              styles.footerBtnLabel,
              { color: canGoBack && !interactionLocked ? colors.text : colors.textSecondary },
            ]}
          >
            Back
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={onFooterNext}
          disabled={interactionLocked}
          style={[styles.footerBtn, interactionLocked && styles.footerBtnDisabled]}
          hitSlop={8}
        >
          <ThemedText style={[styles.footerBtnLabel, { color: colors.tint }]}>
            {isLastStep ? 'Get started' : 'Next'}
          </ThemedText>
          {!isLastStep && <Ionicons name="chevron-forward" size={22} color={colors.tint} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollFlex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  footerBtnDisabled: {
    opacity: 0.45,
  },
  footerBtnLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.xl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  cardWrap: {
    minHeight: 420,
  },
  card: {
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  logoRow: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  iconCircle: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  textBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  successBlock: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 120,
    justifyContent: 'center',
  },
  checkRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successMessage: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
  },
});
