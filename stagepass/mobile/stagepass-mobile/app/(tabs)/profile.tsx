import type { User } from '~/services/api';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
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
import { themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

const U = { xs: 6, sm: 8, md: 12, lg: 14, xl: 16, section: 24 };
const CARD_RADIUS = 12;
import { useAppRole } from '~/hooks/useAppRole';
import { api } from '~/services/api';
import { logout, setUser } from '~/store/authSlice';
import { clearStoredToken } from '~/store/persistAuth';

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
    try {
      await api.auth.logout();
    } catch {
      // offline or already invalid
    }
    await clearStoredToken();
    dispatch(logout());
    router.replace('/login');
  };

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <HomeHeader title="Profile" />
        <ThemedText type="subtitle" style={{ color: colors.textSecondary, padding: U.xl }}>
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
            <View style={[styles.heroCardAccent, { backgroundColor: themeYellow }]} />
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
                  <Ionicons name="camera" size={10} color={isDark ? themeYellow : themeBlue} />
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
          <ThemedText style={[styles.sectionHeading, { color: colors.textSecondary }]}>PREFERENCES</ThemedText>
          <View style={[styles.card, styles.cardVibrant, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={[styles.cardAccent, { backgroundColor: themeYellow }]} />
            <View style={styles.preferenceCardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: themeYellow + '22', borderColor: themeYellow + '66' }]}>
                <Ionicons name="color-palette-outline" size={18} color={themeYellow} />
              </View>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Appearance</ThemedText>
            </View>
            <ThemedText style={[styles.cardSub, { color: colors.textSecondary, marginBottom: U.sm }]}>
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
                      <Ionicons name={icon} size={20} color={selected ? themeBlue : fg} />
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
          <ThemedText style={[styles.sectionHeading, { color: colors.textSecondary }]}>ACCOUNT DETAILS</ThemedText>

          {/* Admin – only for admin role */}
          {role === 'admin' && (
            <View style={[styles.card, styles.cardVibrant, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={[styles.cardAccent, { backgroundColor: isDark ? themeYellow : themeBlue }]} />
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: (isDark ? themeYellow : themeBlue) + '18', borderColor: (isDark ? themeYellow : themeBlue) + '44' }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={colors.brandIcon} />
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
                    onPress={() => router.push(item.href as any)}
                    style={({ pressed }) => [
                      styles.adminLinkRow,
                      { borderBottomColor: cardBorder },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={[styles.adminLinkIconWrap, { backgroundColor: themeYellow + '22', borderColor: themeYellow + '55' }]}>
                      <Ionicons name={item.icon} size={18} color={themeYellow} />
                    </View>
                    <ThemedText style={[styles.adminLinkLabel, { color: colors.text }]}>{item.label}</ThemedText>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Profile photo card */}
          <View style={[styles.card, styles.cardVibrant, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={[styles.cardAccent, { backgroundColor: themeYellow }]} />
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: themeYellow + '22', borderColor: themeYellow + '66' }]}>
                <Ionicons name="person-circle-outline" size={18} color={themeYellow} />
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
                    <Ionicons name="camera-outline" size={32} color={colors.textSecondary} />
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
            <View style={[styles.cardAccent, { backgroundColor: isDark ? themeYellow : themeBlue }]} />
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconWrap, { backgroundColor: (isDark ? themeYellow : themeBlue) + '18', borderColor: (isDark ? themeYellow : themeBlue) + '44' }]}>
                <Ionicons name="person-outline" size={18} color={colors.brandIcon} />
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
            <View style={[styles.cardAccent, { backgroundColor: themeYellow }]} />
            <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: themeYellow + '22', borderColor: themeYellow + '66' }]}>
                <Ionicons name="keypad-outline" size={18} color={themeYellow} />
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
              <View style={[styles.cardAccent, { backgroundColor: isDark ? themeYellow : themeBlue }]} />
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: (isDark ? themeYellow : themeBlue) + '18', borderColor: (isDark ? themeYellow : themeBlue) + '44' }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.brandIcon} />
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
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleLogout}
            >
              <View style={[styles.logoutIconWrap, { backgroundColor: colors.error + '18', borderColor: colors.error + '55' }]}>
                <Ionicons name="log-out-outline" size={18} color={colors.error} />
              </View>
              <ThemedText style={[styles.logoutText, { color: colors.error }]}>Sign out</ThemedText>
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
    paddingHorizontal: U.xl,
    paddingTop: U.lg,
  },
  heroCard: {
    marginBottom: U.lg,
    borderRadius: CARD_RADIUS + 2,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  heroCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: CARD_RADIUS + 2,
    borderBottomLeftRadius: CARD_RADIUS + 2,
  },
  heroCardInner: {
    paddingTop: U.lg,
    paddingBottom: U.md,
    paddingHorizontal: U.xl,
    alignItems: 'center',
  },
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: U.md,
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
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  heroAvatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: U.xs,
    textAlign: 'center',
    letterSpacing: 0.2,
    paddingHorizontal: U.md,
  },
  roleBadge: {
    paddingHorizontal: U.md,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  heroPhotoHint: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: U.xs,
  },
  card: {
    borderRadius: CARD_RADIUS + 2,
    borderWidth: 1,
    padding: U.lg,
    marginBottom: U.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  cardVibrant: {
    position: 'relative',
    overflow: 'hidden',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: CARD_RADIUS + 2,
    borderBottomLeftRadius: CARD_RADIUS + 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: U.sm,
    marginBottom: U.sm,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 12,
    marginBottom: U.md,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: U.sm,
    marginTop: U.lg,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: U.sm,
  },
  preferenceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: U.sm,
    marginBottom: U.xs,
  },
  appearanceRow: {
    flexDirection: 'row',
    gap: U.sm,
    marginTop: U.sm,
  },
  appearanceOption: {
    flex: 1,
    flexDirection: 'column',
    paddingVertical: U.md,
    paddingHorizontal: U.sm,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    gap: U.sm,
  },
  appearanceOptionSwatch: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appearanceOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  appearanceOptionSelected: {
    shadowColor: themeYellow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  adminLinks: { marginTop: U.xs },
  adminLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: U.sm,
    paddingHorizontal: 0,
    gap: U.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  adminLinkIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminLinkLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  input: { marginBottom: U.md },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: U.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: U.xs,
  },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  cardButton: { marginTop: U.sm },
  passportPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: U.lg,
    marginTop: U.sm,
  },
  passportPhotoWrap: {
    width: 88,
    height: 114,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    overflow: 'hidden',
  },
  passportPhotoWrapVibrant: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
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
    fontSize: 11,
    marginTop: U.xs,
  },
  passportUploadBtn: { flex: 1 },
  logoutCard: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    marginBottom: U.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: U.sm,
    paddingVertical: U.lg,
  },
  logoutIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: { fontSize: 14, fontWeight: '600' },
});
