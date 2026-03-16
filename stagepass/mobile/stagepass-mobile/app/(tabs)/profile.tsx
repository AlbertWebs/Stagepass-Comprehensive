import type { User } from '~/services/api';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
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
  View,
} from 'react-native';
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
import { api } from '~/services/api';
import { logout, setUser } from '~/store/authSlice';
import { clearStoredToken } from '~/store/persistAuth';

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
  swatch: Math.round(T * 2.35),     // 40 – appearance option
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

const TAB_BAR_HEIGHT = 58;

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

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setEmail(user.email ?? '');
      setPhoneNumber(user.phone_number ?? '');
      setAddress(user.address ?? '');
      setEmergencyContact(user.emergency_contact ?? '');
    }
  }, [user?.id, user?.name, user?.email, user?.phone_number, user?.address, user?.emergency_contact]);

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
        phone_number?: string;
        address?: string;
        emergency_contact?: string;
        password?: string;
        password_confirmation?: string;
      } = {
        name: trimmedName,
        email: trimmedEmail || undefined,
        phone_number: phoneNumber.trim() || undefined,
        address: address.trim() || undefined,
        emergency_contact: emergencyContact.trim() || undefined,
      };
      if (password) {
        body.password = password;
        body.password_confirmation = passwordConfirmation;
      }
      const updated = await api.auth.updateProfile(body);
      dispatch(setUser(updated));
      setPassword('');
      setPasswordConfirmation('');
      Alert.alert('Saved', 'Your profile has been updated.');
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
      const updatedUser = 'user' in data ? data.user : data;
      dispatch(setUser(updatedUser));
      if (updatedUser?.avatar_url) setPassportPhotoUri(null);
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

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await api.auth.logout();
    } catch {
      // offline or already invalid
    }
    await clearStoredToken();
    dispatch(logout());
    router.replace('/login');
    setSigningOut(false);
  };

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <HomeHeader title="Profile" />
        <ThemedText type="subtitle" style={{ color: colors.textSecondary, padding: P.lg }}>
          Not signed in
        </ThemedText>
      </ThemedView>
    );
  }

  const cardBg = colors.surface;
  const cardBorder = isDark ? themeYellow + '44' : themeBlue + '22';

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="Profile" />
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
                    source={{ uri: passportPhotoUri ?? user?.avatar_url ?? '' }}
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
                    <View style={[styles.appearanceOptionSwatch, { backgroundColor: selected ? themeBlue + '22' : (mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)') }]}>
                      <Ionicons name={icon} size={Icons.standard} color={selected ? themeBlue : fg} />
                    </View>
                    <Text style={[styles.appearanceOptionText, { color: selected ? themeBlue : fg }]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
              >
                {(passportPhotoUri || user?.avatar_url) ? (
                  <Image
                    source={{ uri: passportPhotoUri ?? user?.avatar_url ?? '' }}
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
              </Pressable>
              <StagePassButton
                title={uploadingPhoto ? 'Uploading…' : 'Change photo'}
                onPress={showPhotoPicker}
                disabled={uploadingPhoto}
                variant="outline"
                style={styles.passportUploadBtn}
              />
            </View>
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
              style={styles.input}
            />
            <StagePassInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            <StagePassInput
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Phone number"
              keyboardType="phone-pad"
              style={styles.input}
            />
            <StagePassInput
              value={address}
              onChangeText={setAddress}
              placeholder="Address"
              autoCapitalize="words"
              style={styles.input}
            />
            <StagePassInput
              value={emergencyContact}
              onChangeText={setEmergencyContact}
              placeholder="Emergency contact (name & number)"
              keyboardType="default"
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
              style={styles.input}
            />
            <StagePassInput
              value={newPin}
              onChangeText={setNewPin}
              placeholder="New PIN (min 4)"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={20}
              style={styles.input}
            />
            <StagePassInput
              value={newPinConfirmation}
              onChangeText={setNewPinConfirmation}
              placeholder="Confirm new PIN"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={20}
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
                style={styles.input}
              />
              <StagePassInput
                value={passwordConfirmation}
                onChangeText={setPasswordConfirmation}
                placeholder="Confirm new password"
                secureTextEntry
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

          {/* Sign out */}
          <View style={[styles.logoutCard, { backgroundColor: cardBg, borderColor: colors.error + '44' }]}>
            <Pressable
              style={({ pressed }) => [
                styles.logoutWrap,
                { opacity: signingOut ? 0.8 : pressed ? 0.8 : 1 },
              ]}
              onPress={handleLogout}
              disabled={signingOut}
            >
              {signingOut ? (
                <>
                  <ActivityIndicator size="small" color={colors.error} style={styles.logoutSpinner} />
                  <ThemedText style={[styles.logoutText, { color: colors.error }]}>Signing out…</ThemedText>
                </>
              ) : (
                <>
                  <View style={[styles.logoutIconWrap, { backgroundColor: colors.error + '18', borderColor: colors.error + '55' }]}>
                    <Ionicons name="log-out-outline" size={Icons.header} color={colors.error} />
                  </View>
                  <ThemedText style={[styles.logoutText, { color: colors.error }]}>Sign out</ThemedText>
                </>
              )}
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
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
    borderRadius: P.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    gap: P.sm,
  },
  appearanceOptionSwatch: {
    width: P.swatch,
    height: P.swatch,
    borderRadius: Math.round(T * 0.59),
    justifyContent: 'center',
    alignItems: 'center',
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
    alignItems: 'center',
    gap: P.lg,
    marginTop: P.sm,
  },
  passportPhotoWrap: {
    width: P.passportW,
    height: P.passportH,
    borderRadius: P.radiusMd,
    borderWidth: 1,
    overflow: 'hidden',
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
  },
  passportPhotoPlaceholderText: {
    fontSize: Typography.titleSection,
    marginTop: P.xs,
  },
  passportUploadBtn: { flex: 1 },
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
