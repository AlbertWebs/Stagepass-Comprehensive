import type { User } from '~/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';
import { HomeHeader } from '@/components/HomeHeader';
import { StagePassButton } from '@/components/StagePassButton';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemePreference } from '@/context/ThemePreferenceContext';
import { Cards, Icons, Typography } from '@/constants/ui';
import { Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { NAV_PRESSED_OPACITY, useNavigationPress } from '@/src/utils/navigationPress';
import { useAppRole } from '~/hooks/useAppRole';
import { api, resolveUserAvatarUrl } from '~/services/api';
import { logout, setUser } from '~/store/authSlice';
import {
  clearBiometricLogin,
  enforceServerBiometricPolicyAsync,
  getBiometricLabel,
  getBiometricLoginEnabled,
  isBiometricHardwareAvailable,
  saveBiometricCredential,
} from '~/store/biometricLogin';
import { clearStoredToken, loadStoredToken } from '~/store/persistAuth';
import { PREF_SHOW_WELCOME_STATS_CARDS } from '~/constants/preferences';

/** Profile scale: all spacing and sizes proportional to card title (titleCard = 17) */
const T = Typography.titleCard;
const P = {
  xs: Math.round(T * 0.24),      // 4
  sm: Math.round(T * 0.47),     // 8
  md: Math.round(T * 0.71),     // 12
  lg: Math.round(T * 0.94),     // 16
  xl: Math.round(T * 1.18),     // 20
  xxl: Math.round(T * 1.41),    // 24
  section: Math.round(T * 1.41), // 24 – section top margin
  cardPadding: Math.round(T * 0.94), // 16
  iconSection: Math.round(T * 1.53), // 26 – section title icon wrap
  iconCard: Math.round(T * 1.88),   // 32 – card header icon wrap
  avatar: Math.round(T * 3.53),     // 60
  avatarBadge: Math.round(T * 1.29), // 22
  swatchH: Math.round(T * 1.65),   // 28 – appearance chip height (horizontal bar)
  radiusSm: Math.round(T * 0.47),   // 8
  radiusMd: Math.round(T * 0.94),   // 16
  passportW: Math.round(T * 5.18),  // 88
  passportH: Math.round(T * 6.71),  // 114
};

function roleLabel(role: string) {
  const map: Record<string, string> = {
    admin: 'Admin',
    team_leader: 'Team Leader',
    accountant: 'Accountant',
    logistics: 'Logistics',
    operations: 'Operations',
    crew: 'Crew',
  };
  return map[role] ?? role;
}

function getInitial(name: string): string {
  const n = (name || '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

function extractUserFromPayload(payload: unknown, fallback: User): User {
  if (payload && typeof payload === 'object') {
    if ('user' in payload) {
      const nested = (payload as { user?: unknown }).user;
      if (nested && typeof nested === 'object') {
        return { ...fallback, ...(nested as Partial<User>) };
      }
    }
    if ('id' in payload && 'name' in payload) {
      return { ...fallback, ...(payload as Partial<User>) };
    }
  }
  return fallback;
}

function pickString(user: User | null | undefined, keys: Array<keyof User>): string {
  if (!user) return '';
  for (const key of keys) {
    const value = user[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function normalizeText(value: string): string {
  return value.trim();
}

const TAB_BAR_HEIGHT = 58;

type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

function getDayPeriod(date: Date): DayPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/** Profile tab – premium layout with hero, cards, and clear sections. Fits within safe area. */
export default function ProfileScreen() {
  const router = useRouter();
  const handleNav = useNavigationPress();
  const dispatch = useDispatch();
  const { colors, isDark } = useStagePassTheme();
  const { preference, setPreference } = useThemePreference();
  const user = useSelector((s: { auth: { user: User | null } }) => s.auth.user);
  const role = useAppRole();

  const bottomPadding = TAB_BAR_HEIGHT;
  const [animateKey, setAnimateKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAnimateKey((k) => k + 1);
    }, [])
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirmation, setNewPinConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const [passportPhotoUri, setPassportPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showWelcomeStatsCards, setShowWelcomeStatsCards] = useState(true);
  const [biometricHw, setBiometricHw] = useState(false);
  const [biometricOn, setBiometricOn] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometric');
  const [serverAllowsBiometric, setServerAllowsBiometric] = useState(true);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(PREF_SHOW_WELCOME_STATS_CARDS)
      .then((v) => {
        if (!mounted) return;
        if (v == null) setShowWelcomeStatsCards(true);
        else setShowWelcomeStatsCards(v === '1');
      })
      .catch(() => {
        if (mounted) setShowWelcomeStatsCards(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const allowed = await enforceServerBiometricPolicyAsync();
        if (!active) return;
        setServerAllowsBiometric(allowed);
        const [hw, on, label] = await Promise.all([
          isBiometricHardwareAvailable(),
          getBiometricLoginEnabled(),
          getBiometricLabel(),
        ]);
        if (!active) return;
        setBiometricHw(hw);
        setBiometricOn(on);
        setBiometricLabel(label);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setEmail(user.email ?? '');
      setPhoneNumber(pickString(user, ['phone_number', 'phone']));
      setAddress(user.address ?? '');
      setEmergencyContact(pickString(user, ['emergency_contact', 'emergencyContact']));
    }
  }, [
    user?.id,
    user?.name,
    user?.email,
    user?.phone_number,
    user?.phone,
    user?.address,
    user?.emergency_contact,
    user?.emergencyContact,
  ]);

  const handleSave = async () => {
    if (!user) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      Alert.alert('Invalid', 'Name is required.');
      return;
    }
    if (password !== passwordConfirmation) {
      Alert.alert('Invalid', 'Passwords do not match.');
      return;
    }
    if (password && password.length < 8) {
      Alert.alert('Invalid', 'Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      const body: {
        name?: string;
        email?: string;
        phone?: string;
        phone_number?: string;
        address?: string;
        emergencyContact?: string;
        emergency_contact?: string;
        password?: string;
        password_confirmation?: string;
      } = {
        name: trimmedName,
        email: trimmedEmail || undefined,
        phone: phoneNumber.trim() || undefined,
        phone_number: phoneNumber.trim() || undefined,
        address: address.trim() || undefined,
        emergencyContact: emergencyContact.trim() || undefined,
        emergency_contact: emergencyContact.trim() || undefined,
      };
      if (password) {
        body.password = password;
        body.password_confirmation = passwordConfirmation;
      }
      const updated = await api.auth.updateProfile(body);
      const normalizedUser = extractUserFromPayload(updated, user);
      const freshUser = await api.auth.me().catch(() => null);
      const persistedUser = freshUser
        ? extractUserFromPayload(freshUser, normalizedUser)
        : normalizedUser;
      dispatch(setUser(persistedUser));
      setPassword('');
      setPasswordConfirmation('');
      const intendedPhone = normalizeText(phoneNumber);
      const intendedAddress = normalizeText(address);
      const intendedEmergency = normalizeText(emergencyContact);
      const savedPhone = normalizeText(pickString(persistedUser, ['phone_number', 'phone']));
      const savedAddress = normalizeText(persistedUser.address ?? '');
      const savedEmergency = normalizeText(
        pickString(persistedUser, ['emergency_contact', 'emergencyContact'])
      );
      const missingPersistence: string[] = [];
      if (intendedPhone !== savedPhone) missingPersistence.push('phone number');
      if (intendedAddress !== savedAddress) missingPersistence.push('address');
      if (intendedEmergency !== savedEmergency) missingPersistence.push('emergency contact');

      if (missingPersistence.length > 0) {
        Alert.alert(
          'Not fully saved',
          `Server did not persist: ${missingPersistence.join(', ')}. Check backend profile fields on /api/me.`
        );
      } else {
        Alert.alert('Saved', 'Your profile has been updated.');
      }
    } catch (e) {
      Alert.alert(
        'Update failed',
        e instanceof Error ? e.message : 'Could not update profile. Try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChangePin = async () => {
    if (!user) return;
    const cur = currentPin.trim();
    const np = newPin.trim();
    const npConfirm = newPinConfirmation.trim();
    if (!cur) {
      Alert.alert('Invalid', 'Enter your current PIN.');
      return;
    }
    if (!np || np.length < 4) {
      Alert.alert('Invalid', 'New PIN must be at least 4 characters.');
      return;
    }
    if (np !== npConfirm) {
      Alert.alert('Invalid', 'New PIN and confirmation do not match.');
      return;
    }
    setChangingPin(true);
    try {
      await api.auth.updateProfile({
        current_pin: cur,
        new_pin: np,
        new_pin_confirmation: npConfirm,
      });
      setCurrentPin('');
      setNewPin('');
      setNewPinConfirmation('');
      Alert.alert('PIN updated', 'Use your new PIN to sign in next time.');
    } catch (e) {
      Alert.alert(
        'PIN change failed',
        e instanceof Error ? e.message : 'Check your current PIN and try again.'
      );
    } finally {
      setChangingPin(false);
    }
  };

  const uploadImageUri = async (uri: string) => {
    setPassportPhotoUri(uri);
    setUploadingPhoto(true);
    try {
      const data = await api.auth.uploadProfilePhoto(uri);
      const updatedUser = extractUserFromPayload(data, user);
      const fixedAvatar = resolveUserAvatarUrl(updatedUser.avatar_url);
      dispatch(setUser({ ...user, ...updatedUser, ...(fixedAvatar ? { avatar_url: fixedAvatar } : {}) }));
      if (fixedAvatar) setPassportPhotoUri(null);
      Alert.alert('Saved', 'Your profile photo has been updated.');
    } catch (e) {
      Alert.alert(
        'Upload failed',
        e instanceof Error ? e.message : 'Could not upload photo. Your backend may need a POST /api/me/photo endpoint.'
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a profile photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await uploadImageUri(result.assets[0].uri);
  };

  const handleChooseFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to choose an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await uploadImageUri(result.assets[0].uri);
  };

  const showPhotoPicker = () => {
    if (uploadingPhoto) return;
    Alert.alert('Profile photo', 'Take a new photo or choose one from your device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take photo', onPress: handleTakePhoto },
      { text: 'Choose from library', onPress: handleChooseFromLibrary },
    ]);
  };

  const toggleBiometricLogin = useCallback(async () => {
    if (biometricOn) {
      Alert.alert('Turn off biometric login?', 'You will sign in with username and PIN only.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: async () => {
            await clearBiometricLogin();
            setBiometricOn(false);
          },
        },
      ]);
      return;
    }
    try {
      const token = await loadStoredToken();
      if (!token) {
        Alert.alert('Session unavailable', 'Sign out and sign in again, then enable biometric login.');
        return;
      }
      await saveBiometricCredential(token);
      setBiometricOn(true);
      Alert.alert('Enabled', `${biometricLabel} sign-in is enabled on this device.`);
    } catch (e) {
      Alert.alert('Could not enable', e instanceof Error ? e.message : 'Try again.');
    }
  }, [biometricOn, biometricLabel]);

  const toggleWelcomeStatsCards = useCallback(async () => {
    const next = !showWelcomeStatsCards;
    setShowWelcomeStatsCards(next);
    try {
      await AsyncStorage.setItem(PREF_SHOW_WELCOME_STATS_CARDS, next ? '1' : '0');
    } catch {
      // Keep UI responsive even if persistence fails.
    }
  }, [showWelcomeStatsCards]);

  const cardBg = colors.surface;
  const cardBorder = isDark ? themeYellow + '44' : themeBlue + '22';
  const dayPeriod = getDayPeriod(new Date());
  const heroPatternTheme = (() => {
    const map: Record<DayPeriod, { strong: string; soft: string; filled: string }> = {
      morning: {
        strong: isDark ? 'rgba(250, 204, 21, 0.12)' : 'rgba(245, 158, 11, 0.14)',
        soft: isDark ? 'rgba(250, 204, 21, 0.10)' : 'rgba(245, 158, 11, 0.10)',
        filled: isDark ? 'rgba(250, 204, 21, 0.08)' : 'rgba(245, 158, 11, 0.08)',
      },
      afternoon: {
        strong: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.14)',
        soft: isDark ? 'rgba(16, 185, 129, 0.10)' : 'rgba(16, 185, 129, 0.10)',
        filled: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.08)',
      },
      evening: {
        strong: isDark ? 'rgba(99, 102, 241, 0.14)' : 'rgba(37, 99, 235, 0.12)',
        soft: isDark ? 'rgba(99, 102, 241, 0.11)' : 'rgba(37, 99, 235, 0.10)',
        filled: isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(37, 99, 235, 0.08)',
      },
      night: {
        strong: isDark ? 'rgba(168, 85, 247, 0.14)' : 'rgba(79, 70, 229, 0.12)',
        soft: isDark ? 'rgba(168, 85, 247, 0.11)' : 'rgba(79, 70, 229, 0.10)',
        filled: isDark ? 'rgba(168, 85, 247, 0.08)' : 'rgba(79, 70, 229, 0.08)',
      },
    };
    return map[dayPeriod];
  })();

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <HomeHeader title="Profile" />
        <Animated.View key={animateKey} entering={SlideInRight.duration(320)} style={{ flex: 1 }}>
          <ThemedText type="subtitle" style={{ color: colors.textSecondary, padding: P.lg }}>
            Not signed in
          </ThemedText>
        </Animated.View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="Profile" />
      <Animated.View key={animateKey} entering={SlideInRight.duration(320)} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Name & role card – subtle tint, no solid block */}
          <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View pointerEvents="none" style={styles.heroPatternLayer}>
              <View
                style={[
                  styles.heroHexShape,
                  styles.heroHexOne,
                  { borderColor: heroPatternTheme.strong, backgroundColor: 'transparent' },
                ]}
              />
              <View
                style={[
                  styles.heroHexShapeSmall,
                  styles.heroHexTwo,
                  { borderColor: heroPatternTheme.soft, backgroundColor: 'transparent' },
                ]}
              />
              <View
                style={[
                  styles.heroHexShapeDot,
                  styles.heroHexThree,
                  { backgroundColor: heroPatternTheme.filled },
                ]}
              />
            </View>
            <LinearGradient
              colors={isDark ? [themeBlue + '18', themeBlue + '08', 'transparent'] : [themeYellow + '0c', themeBlue + '06', 'transparent']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.heroCardInner}>
              <Pressable
                onPress={showPhotoPicker}
                style={({ pressed }) => [
                  styles.avatarWrap,
                  { borderColor: isDark ? themeYellow + '99' : themeBlue + '99' },
                  pressed && styles.avatarWrapPressed,
                ]}
                accessibilityLabel="Update profile photo"
                accessibilityRole="button"
              >
                {(passportPhotoUri || user?.avatar_url) ? (
                  <Image
                    source={{
                      uri: passportPhotoUri ?? resolveUserAvatarUrl(user?.avatar_url) ?? user?.avatar_url ?? '',
                    }}
                    style={styles.heroAvatarImage}
                    contentFit="cover"
                  />
                ) : (
                  <ThemedText style={[styles.avatarText, { color: isDark ? themeYellow : themeBlue }]}>{getInitial(user.name)}</ThemedText>
                )}
                <View style={[styles.avatarEditBadge, { backgroundColor: colors.surface, borderColor: isDark ? themeYellow : themeBlue }]}>
                  <Ionicons name="camera" size={Icons.xs} color={isDark ? themeYellow : themeBlue} />
                </View>
              </Pressable>
              <ThemedText style={[styles.heroName, { color: colors.text }]} numberOfLines={2}>
                {user.name}
              </ThemedText>
              <View style={[styles.roleBadge, { backgroundColor: (isDark ? themeYellow : themeBlue) + '18', borderColor: (isDark ? themeYellow : themeBlue) + '55' }]}>
                <ThemedText style={[styles.roleBadgeText, { color: isDark ? themeYellow : themeBlue }]}>
                  {roleLabel(role)}
                </ThemedText>
              </View>
              <ThemedText style={[styles.heroPhotoHint, { color: colors.textSecondary }]}>
                Tap photo to update
              </ThemedText>
            </View>
          </View>

          {/* PREFERENCES: Appearance – colored cards for Light / Dark / Auto */}
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionTitleIconWrap, { backgroundColor: themeYellow + '28' }]}>
              <Ionicons name="options-outline" size={Icons.small} color={themeYellow} />
            </View>
            <ThemedText style={[styles.sectionHeading, { color: colors.textSecondary }]}>PREFERENCES</ThemedText>
          </View>
          <View style={[styles.card, styles.cardVibrant, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.preferenceCardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: themeYellow + '22', borderColor: themeYellow + '66' }]}>
                <Ionicons name="color-palette-outline" size={Icons.header} color={themeYellow} />
              </View>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Appearance</ThemedText>
            </View>
            <ThemedText style={[styles.cardSub, { color: colors.textSecondary, marginBottom: P.sm }]}>
              Choose how the app looks. Dark uses a dark background.
            </ThemedText>
            <View style={styles.appearanceRow}>
              {([
                { mode: 'light' as const, label: 'Light', icon: 'sunny-outline' as const, bg: '#f4f4f5', fg: '#18181b' },
                { mode: 'dark' as const, label: 'Dark', icon: 'moon-outline' as const, bg: '#1a1a1a', fg: '#fafafa' },
                { mode: 'system' as const, label: 'Auto', icon: 'phone-portrait-outline' as const, bg: '#d4d4d8', fg: '#52525b' },
              ]).map(({ mode, label, icon, bg, fg }) => {
                const selected = preference === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setPreference(mode)}
                    style={({ pressed }) => [
                      styles.appearanceOption,
                      { backgroundColor: selected ? themeYellow : bg, borderColor: selected ? themeYellow : (mode === 'dark' ? '#2d2d2d' : themeBlue + '44'), borderWidth: selected ? 2.5 : 2 },
                      selected && styles.appearanceOptionSelected,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Ionicons name={icon} size={Icons.standard} color={selected ? themeBlue : fg} />
                    <Text style={[styles.appearanceOptionText, { color: selected ? themeBlue : fg }]} numberOfLines={1}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={toggleWelcomeStatsCards}
              style={({ pressed }) => [
                styles.settingRow,
                { borderTopColor: cardBorder, opacity: pressed ? NAV_PRESSED_OPACITY : 1 },
              ]}
            >
              <View style={styles.settingRowTextWrap}>
                <ThemedText style={[styles.settingRowTitle, { color: colors.text }]}>Welcome stats cards</ThemedText>
                <ThemedText style={[styles.settingRowSub, { color: colors.textSecondary }]}>
                  Show Events, Tasks, and Notices chips on the Home welcome card
                </ThemedText>
              </View>
              <Ionicons
                name={showWelcomeStatsCards ? 'eye-outline' : 'eye-off-outline'}
                size={Icons.header}
                color={showWelcomeStatsCards ? themeYellow : colors.textSecondary}
              />
            </Pressable>
            {biometricHw && serverAllowsBiometric ? (
              <Pressable
                onPress={toggleBiometricLogin}
                style={({ pressed }) => [
                  styles.settingRow,
                  { borderTopColor: cardBorder, opacity: pressed ? NAV_PRESSED_OPACITY : 1 },
                ]}
              >
                <View style={styles.settingRowTextWrap}>
                  <ThemedText style={[styles.settingRowTitle, { color: colors.text }]}>{biometricLabel} login</ThemedText>
                  <ThemedText style={[styles.settingRowSub, { color: colors.textSecondary }]}>
                    Sign in on the login screen without typing your PIN
                  </ThemedText>
                </View>
                <Ionicons
                  name={biometricOn ? 'toggle' : 'toggle-outline'}
                  size={Icons.header}
                  color={biometricOn ? themeYellow : colors.textSecondary}
                />
              </Pressable>
            ) : biometricHw && !serverAllowsBiometric ? (
              <View style={[styles.settingRow, { borderTopColor: cardBorder }]}>
                <View style={styles.settingRowTextWrap}>
                  <ThemedText style={[styles.settingRowTitle, { color: colors.text }]}>{biometricLabel} login</ThemedText>
                  <ThemedText style={[styles.settingRowSub, { color: colors.textSecondary }]}>
                    Disabled in System Settings — sign in with username and PIN
                  </ThemedText>
                </View>
                <Ionicons name="lock-closed-outline" size={Icons.header} color={colors.textSecondary} />
              </View>
            ) : null}
          </View>

          {/* ACCOUNT DETAILS */}
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionTitleIconWrap, { backgroundColor: (isDark ? themeYellow : themeBlue) + '28' }]}>
              <Ionicons name="person-circle-outline" size={Icons.small} color={colors.brandIcon} />
            </View>
            <ThemedText style={[styles.sectionHeading, { color: colors.textSecondary }]}>ACCOUNT DETAILS</ThemedText>
          </View>

          {/* Admin – only for admin role */}
          {role === 'admin' && (
            <View style={[styles.card, styles.cardVibrant, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: (isDark ? themeYellow : themeBlue) + '18', borderColor: (isDark ? themeYellow : themeBlue) + '44' }]}>
                  <Ionicons name="shield-checkmark-outline" size={Icons.header} color={colors.brandIcon} />
                </View>
                <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Admin</ThemedText>
              </View>
              <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>
                Manage events, crew, and settings
              </ThemedText>
              <View style={styles.adminLinks}>
                {[
                  { label: 'Events', icon: 'calendar-outline' as const, href: '/admin/events' },
                  { label: 'User & crew', icon: 'people-outline' as const, href: '/admin/users' },
                  { label: 'Equipment', icon: 'cube-outline' as const, href: '/admin/equipment' },
                  { label: 'Communication', icon: 'chatbubbles-outline' as const, href: '/admin/communications' },
                  { label: 'Time off', icon: 'time-outline' as const, href: '/admin/timeoff' },
                  { label: 'Settings', icon: 'settings-outline' as const, href: '/admin/settings' },
                ].map((item) => (
                  <Pressable
                    key={item.href}
                    onPress={() => handleNav(() => router.push(item.href as any))}
                    style={({ pressed }) => [
                      styles.adminLinkRow,
                      { borderBottomColor: cardBorder },
                      pressed && { opacity: NAV_PRESSED_OPACITY },
                    ]}
                  >
                    <View style={[styles.adminLinkIconWrap, { backgroundColor: themeYellow + '22', borderColor: themeYellow + '55' }]}>
                      <Ionicons name={item.icon} size={Icons.header} color={themeYellow} />
                    </View>
                    <ThemedText style={[styles.adminLinkLabel, { color: colors.text }]}>{item.label}</ThemedText>
                    <Ionicons name="chevron-forward" size={Icons.medium} color={colors.textSecondary} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Profile photo card */}
          <View style={[styles.card, styles.cardVibrant, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: themeYellow + '22', borderColor: themeYellow + '66' }]}>
                <Ionicons name="person-circle-outline" size={Icons.header} color={themeYellow} />
              </View>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Profile photo</ThemedText>
            </View>
            <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>
              Take a photo or choose an image from your device. This will be your profile picture.
            </ThemedText>
            <View style={styles.passportPhotoRow}>
              <Pressable
                onPress={showPhotoPicker}
                disabled={uploadingPhoto}
                style={({ pressed }) => [
                  styles.passportPhotoWrap,
                  styles.passportPhotoWrapVibrant,
                  { borderColor: themeYellow + '66', backgroundColor: colors.surface },
                  pressed && !uploadingPhoto && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Update profile photo"
              >
                {(passportPhotoUri || user?.avatar_url) ? (
                  <Image
                    source={{
                      uri: passportPhotoUri ?? resolveUserAvatarUrl(user?.avatar_url) ?? user?.avatar_url ?? '',
                    }}
                    style={styles.passportPhoto}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.passportPhotoPlaceholder}>
                    <Ionicons name="camera-outline" size={Icons.large} color={colors.textSecondary} />
                    <ThemedText style={[styles.passportPhotoPlaceholderText, { color: colors.textSecondary }]}>
                      Tap to add photo
                    </ThemedText>
                  </View>
                )}
                <View style={[styles.passportPhotoBadge, { backgroundColor: colors.surface, borderColor: themeYellow + '66' }]}>
                  <Ionicons name="camera-outline" size={Icons.xs} color={themeYellow} />
                </View>
              </Pressable>
              <View style={styles.passportPhotoActions}>
                <ThemedText style={[styles.passportPhotoActionTitle, { color: colors.text }]}>
                  {passportPhotoUri || user?.avatar_url ? 'Update your photo' : 'Add your profile photo'}
                </ThemedText>
                <ThemedText style={[styles.passportPhotoActionSub, { color: colors.textSecondary }]}>
                  Use a clear headshot so team members can identify you quickly.
                </ThemedText>
                <StagePassButton
                  title={uploadingPhoto ? 'Uploading…' : 'Choose photo'}
                  onPress={showPhotoPicker}
                  disabled={uploadingPhoto}
                  variant="outline"
                  style={styles.passportUploadBtn}
                />
                <ThemedText style={[styles.passportPhotoHint, { color: colors.textSecondary }]}>
                  Tip: portrait image, good lighting, face centered.
                </ThemedText>
              </View>
            </View>
            <Pressable
              onPress={() => handleNav(() => router.push('/(tabs)/preferences'))}
              style={({ pressed }) => [
                styles.adminLinkRow,
                { borderBottomColor: cardBorder, marginTop: P.sm, borderBottomWidth: 0, opacity: pressed ? NAV_PRESSED_OPACITY : 1 },
              ]}
            >
              <View style={[styles.adminLinkIconWrap, { backgroundColor: themeYellow + '22', borderColor: themeYellow + '55' }]}>
                <Ionicons name="options-outline" size={Icons.header} color={themeYellow} />
              </View>
              <ThemedText style={[styles.adminLinkLabel, { color: colors.text }]}>Preferences</ThemedText>
              <Ionicons name="chevron-forward" size={Icons.medium} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Personal info card */}
          <View style={[styles.card, styles.cardVibrant, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: (isDark ? themeYellow : themeBlue) + '18', borderColor: (isDark ? themeYellow : themeBlue) + '44' }]}>
                <Ionicons name="person-outline" size={Icons.header} color={colors.brandIcon} />
              </View>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Personal info</ThemedText>
            </View>
            <StagePassInput
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              autoCapitalize="words"
              compact
              style={styles.input}
            />
            <StagePassInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              compact
              style={styles.input}
            />
            <StagePassInput
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Phone number"
              keyboardType="phone-pad"
              compact
              style={styles.input}
            />
            <StagePassInput
              value={address}
              onChangeText={setAddress}
              placeholder="Address"
              autoCapitalize="words"
              compact
              style={styles.input}
            />
            <StagePassInput
              value={emergencyContact}
              onChangeText={setEmergencyContact}
              placeholder="Emergency contact (name & number)"
              keyboardType="default"
              compact
              style={styles.input}
            />
            {user.username ? (
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Username</ThemedText>
                <ThemedText style={[styles.infoValue, { color: colors.text }]}>{user.username}</ThemedText>
              </View>
            ) : null}
            {user.staff_id ? (
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Staff ID</ThemedText>
                <ThemedText style={[styles.infoValue, { color: colors.text }]}>{user.staff_id}</ThemedText>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: colors.textSecondary }]}>Role</ThemedText>
              <ThemedText style={[styles.infoValue, { color: colors.text }]}>{roleLabel(role)}</ThemedText>
            </View>
            <StagePassButton
              title={saving ? 'Saving…' : 'Save changes'}
              onPress={handleSave}
              disabled={saving}
              style={styles.cardButton}
            />
          </View>

          {/* Security: PIN card */}
          <View style={[styles.card, styles.cardVibrant, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: themeYellow + '22', borderColor: themeYellow + '66' }]}>
                <Ionicons name="keypad-outline" size={Icons.header} color={themeYellow} />
              </View>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Change PIN</ThemedText>
            </View>
            <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>
              Used to sign in on this app
            </ThemedText>
            <StagePassInput
              value={currentPin}
              onChangeText={setCurrentPin}
              placeholder="Current PIN"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={20}
              compact
              style={styles.input}
            />
            <StagePassInput
              value={newPin}
              onChangeText={setNewPin}
              placeholder="New PIN (min 4)"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={20}
              compact
              style={styles.input}
            />
            <StagePassInput
              value={newPinConfirmation}
              onChangeText={setNewPinConfirmation}
              placeholder="Confirm new PIN"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={20}
              compact
              style={styles.input}
            />
            <StagePassButton
              title={changingPin ? 'Updating…' : 'Change PIN'}
              onPress={handleChangePin}
              disabled={changingPin}
              variant="outline"
              style={styles.cardButton}
            />
          </View>

          {/* Security: Password card – admin only (web login) */}
          {role === 'admin' ? (
            <View style={[styles.card, styles.cardVibrant, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: (isDark ? themeYellow : themeBlue) + '18', borderColor: (isDark ? themeYellow : themeBlue) + '44' }]}>
                  <Ionicons name="lock-closed-outline" size={Icons.header} color={colors.brandIcon} />
                </View>
                <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Change password</ThemedText>
              </View>
              <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>
                For web admin login
              </ThemedText>
              <StagePassInput
                value={password}
                onChangeText={setPassword}
                placeholder="New password"
                secureTextEntry
                compact
                style={styles.input}
              />
              <StagePassInput
                value={passwordConfirmation}
                onChangeText={setPasswordConfirmation}
                placeholder="Confirm new password"
                secureTextEntry
                compact
                style={styles.input}
              />
              <StagePassButton
                title={saving ? 'Updating…' : 'Update password'}
                onPress={handleSave}
                disabled={saving}
                variant="outline"
                style={styles.cardButton}
              />
            </View>
          ) : null}

        </ScrollView>
      </KeyboardAvoidingView>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  scrollContent: {
    paddingHorizontal: P.lg,
    paddingTop: P.lg,
  },
  heroCard: {
    marginBottom: P.lg,
    borderRadius: P.radiusMd,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: P.sm,
    elevation: 3,
  },
  heroCardInner: {
    paddingTop: P.lg,
    paddingBottom: P.md,
    paddingHorizontal: P.lg,
    alignItems: 'center',
  },
  heroPatternLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  heroHexShape: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderWidth: 1.5,
    borderRadius: 14,
    transform: [{ rotate: '30deg' }],
  },
  heroHexShapeSmall: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderWidth: 1.5,
    borderRadius: 10,
    transform: [{ rotate: '30deg' }],
  },
  heroHexShapeDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 5,
    transform: [{ rotate: '30deg' }],
  },
  heroHexOne: {
    top: -4,
    right: -8,
    transform: [{ rotate: '12deg' }],
  },
  heroHexTwo: {
    bottom: 10,
    right: 44,
    transform: [{ rotate: '-8deg' }],
  },
  heroHexThree: {
    top: 22,
    left: 18,
    transform: [{ rotate: '10deg' }],
  },
  avatarWrap: {
    width: P.avatar,
    height: P.avatar,
    borderRadius: P.avatar / 2,
    borderWidth: 2,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: P.md,
    overflow: 'hidden',
  },
  avatarWrapPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: P.avatarBadge,
    height: P.avatarBadge,
    borderRadius: P.avatarBadge / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  heroAvatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: Typography.titleHero,
    fontWeight: Typography.titleLargeWeight,
    letterSpacing: 0.6,
  },
  heroName: {
    fontSize: Typography.titleLarge,
    fontWeight: Typography.bodyBoldWeight,
    marginBottom: P.xs,
    textAlign: 'center',
    letterSpacing: 0.2,
    paddingHorizontal: P.md,
  },
  roleBadge: {
    paddingHorizontal: P.md,
    paddingVertical: P.xs,
    borderRadius: 9999,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: Typography.titleSection,
    fontWeight: Typography.labelWeight,
    letterSpacing: 0.3,
  },
  heroPhotoHint: {
    fontSize: Typography.statLabel,
    fontWeight: '500',
    marginTop: P.xs,
  },
  card: {
    borderRadius: P.radiusMd,
    borderWidth: 1,
    padding: P.cardPadding,
    marginBottom: P.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: P.md,
    elevation: 3,
  },
  cardVibrant: {
    position: 'relative',
    overflow: 'hidden',
    shadowOpacity: 0.06,
    shadowRadius: P.sm,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: P.sm,
    marginBottom: P.sm,
  },
  cardIconWrap: {
    width: P.iconCard,
    height: P.iconCard,
    borderRadius: P.radiusMd,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: Typography.titleCard,
    fontWeight: Typography.titleCardWeight,
  },
  cardSub: {
    fontSize: Typography.label,
    marginBottom: P.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: P.sm,
    marginBottom: P.sm,
    marginTop: P.section,
  },
  sectionTitleIconWrap: {
    width: P.iconSection,
    height: P.iconSection,
    borderRadius: P.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeading: {
    fontSize: Typography.titleSection,
    fontWeight: Typography.titleSectionWeight,
    letterSpacing: Typography.titleSectionLetterSpacing,
    textTransform: 'uppercase',
    flex: 1,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: P.sm,
  },
  preferenceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: P.sm,
    marginBottom: P.xs,
  },
  appearanceRow: {
    flexDirection: 'row',
    gap: P.sm,
    marginTop: P.sm,
  },
  appearanceOption: {
    flex: 1,
    flexDirection: 'column',
    paddingVertical: P.md,
    paddingHorizontal: P.sm,
    borderRadius: P.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: P.sm,
  },
  appearanceOptionText: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.buttonTextWeight,
  },
  appearanceOptionSelected: {
    shadowColor: themeYellow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: P.xs,
    elevation: 3,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: P.sm,
    marginTop: P.md,
    paddingTop: P.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  settingRowTextWrap: { flex: 1, minWidth: 0 },
  settingRowTitle: { fontSize: Typography.bodySmall, fontWeight: '700' },
  settingRowSub: { fontSize: Typography.label, marginTop: 2, lineHeight: 16 },
  adminLinks: { marginTop: P.xs },
  adminLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: P.sm,
    paddingHorizontal: 0,
    gap: P.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  adminLinkIconWrap: {
    width: P.iconCard,
    height: P.iconCard,
    borderRadius: P.radiusSm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminLinkLabel: { flex: 1, fontSize: Typography.bodySmall, fontWeight: '600' },
  input: { marginBottom: P.md },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: P.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: P.xs,
  },
  infoLabel: { fontSize: Typography.bodySmall },
  infoValue: { fontSize: Typography.bodySmall, fontWeight: '600' },
  cardButton: { marginTop: P.sm },
  passportPhotoRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: P.md,
    marginTop: P.sm,
  },
  passportPhotoWrap: {
    width: Math.max(P.passportW + 16, 104),
    height: Math.max(P.passportW + 16, 104),
    borderRadius: P.radiusMd,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  passportPhotoWrapVibrant: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: P.xs,
    elevation: 3,
  },
  passportPhoto: {
    width: '100%',
    height: '100%',
  },
  passportPhotoPlaceholder: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: P.xs,
  },
  passportPhotoPlaceholderText: {
    fontSize: Typography.bodySmall,
    fontWeight: '600',
    marginTop: P.xs,
    textAlign: 'center',
  },
  passportPhotoBadge: {
    position: 'absolute',
    right: P.xs,
    bottom: P.xs,
    width: P.avatarBadge,
    height: P.avatarBadge,
    borderRadius: P.avatarBadge / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passportPhotoActions: {
    flex: 1,
    justifyContent: 'center',
    minHeight: Math.max(P.passportW + 16, 104),
  },
  passportPhotoActionTitle: {
    fontSize: Typography.body,
    fontWeight: Typography.titleCardWeight,
  },
  passportPhotoActionSub: {
    fontSize: Typography.bodySmall,
    marginTop: 2,
    marginBottom: P.sm,
    lineHeight: 18,
  },
  passportUploadBtn: {
    width: '100%',
  },
  passportPhotoHint: {
    fontSize: Typography.labelSmall,
    marginTop: P.xs,
  },
  logoutCard: {
    borderRadius: P.radiusMd,
    borderWidth: 1,
    marginBottom: P.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: P.xs,
    elevation: 2,
  },
  logoutWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: P.sm,
    paddingVertical: P.lg,
  },
  logoutIconWrap: {
    width: P.iconCard,
    height: P.iconCard,
    borderRadius: P.radiusSm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: { fontSize: Typography.bodySmall, fontWeight: '600' },
  logoutSpinner: { marginRight: P.sm },
});
