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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { HomeHeader } from '@/components/HomeHeader';
import { StagePassButton } from '@/components/StagePassButton';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemePreference } from '@/context/ThemePreferenceContext';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useDispatch();
  const { colors } = useStagePassTheme();
  const { preference, setPreference } = useThemePreference();
  const user = useSelector((s: { auth: { user: User | null } }) => s.auth.user);
  const role = useAppRole();

  const bottomPadding = Math.max(insets.bottom + TAB_BAR_HEIGHT + Spacing.sm, 28);

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

  const handleUploadPassportPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to upload a passport photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    setPassportPhotoUri(uri);
    setUploadingPhoto(true);
    try {
      const data = await api.auth.uploadProfilePhoto(uri);
      const updatedUser = 'user' in data ? data.user : data;
      dispatch(setUser(updatedUser));
      // Clear local URI only when backend returns an avatar URL so image stays visible
      if (updatedUser?.avatar_url) setPassportPhotoUri(null);
      Alert.alert('Saved', 'Passport photo updated.');
    } catch (e) {
      Alert.alert(
        'Upload failed',
        e instanceof Error ? e.message : 'Could not upload photo. Your backend may need a POST /api/me/photo endpoint.'
      );
    } finally {
      setUploadingPhoto(false);
    }
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
        <ThemedText type="subtitle" style={{ color: colors.textSecondary, padding: Spacing.xl }}>
          Not signed in
        </ThemedText>
      </ThemedView>
    );
  }

  const cardBg = colors.surface;
  const cardBorder = colors.border;

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
          {/* Hero header */}
          <LinearGradient
            colors={[themeBlue, themeBlue + 'ee', themeBlue + 'cc']}
            style={styles.hero}
          >
            <View style={[styles.avatarWrap, { borderColor: themeYellow }]}>
              {(passportPhotoUri || user?.avatar_url) ? (
                <Image
                  source={{ uri: passportPhotoUri ?? user?.avatar_url ?? '' }}
                  style={styles.heroAvatarImage}
                  contentFit="cover"
                />
              ) : (
                <ThemedText style={styles.avatarText}>{getInitial(user.name)}</ThemedText>
              )}
            </View>
            <ThemedText style={styles.heroName} numberOfLines={1}>
              {user.name}
            </ThemedText>
            <View style={[styles.roleBadge, { backgroundColor: themeYellow + '22', borderColor: themeYellow }]}>
              <ThemedText style={[styles.roleBadgeText, { color: themeYellow }]}>
                {roleLabel(role)}
              </ThemedText>
            </View>
          </LinearGradient>

          {/* Appearance card – Light / Dark / Auto */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="moon-outline" size={20} color={themeYellow} />
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Appearance</ThemedText>
            </View>
            <View style={styles.appearanceRow}>
              {(['dark', 'light', 'system'] as const).map((mode) => {
                const selected = preference === mode;
                const label = mode === 'system' ? 'Auto' : mode === 'light' ? 'Light' : 'Dark';
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setPreference(mode)}
                    style={({ pressed }) => [
                      styles.appearanceOption,
                      { borderColor: cardBorder },
                      selected && { backgroundColor: themeYellow, borderColor: themeYellow },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.appearanceOptionText,
                        { color: selected ? themeBlue : colors.text },
                      ]}
                    >
                      {label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Admin – only for admin role */}
          {role === 'admin' && (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="shield-checkmark-outline" size={20} color={themeYellow} />
                <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Admin</ThemedText>
              </View>
              <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>
                Manage events, crew, and settings
              </ThemedText>
              <View style={styles.adminLinks}>
                {[
                  { label: 'Events', icon: 'calendar-outline' as const, href: '/admin/events' },
                  { label: 'Users & Crew', icon: 'people-outline' as const, href: '/admin/users' },
                  { label: 'Equipment', icon: 'cube-outline' as const, href: '/admin/equipment' },
                  { label: 'Clients', icon: 'business-outline' as const, href: '/admin/clients' },
                  { label: 'Reports', icon: 'bar-chart-outline' as const, href: '/admin/reports' },
                  { label: 'Payments', icon: 'card-outline' as const, href: '/admin/payments' },
                  { label: 'Time off', icon: 'time-outline' as const, href: '/admin/timeoff' },
                  { label: 'Communication', icon: 'chatbubbles-outline' as const, href: '/admin/communications' },
                  { label: 'Settings', icon: 'settings-outline' as const, href: '/admin/settings' },
                  { label: 'Audit logs', icon: 'document-text-outline' as const, href: '/admin/audit' },
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
                    <Ionicons name={item.icon} size={20} color={themeYellow} />
                    <ThemedText style={[styles.adminLinkLabel, { color: colors.text }]}>{item.label}</ThemedText>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Passport photo card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="id-card-outline" size={20} color={themeYellow} />
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Passport photo</ThemedText>
            </View>
            <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>
              Upload a clear photo of your passport or ID for verification
            </ThemedText>
            <View style={styles.passportPhotoRow}>
              <View style={[styles.passportPhotoWrap, { borderColor: cardBorder, backgroundColor: colors.surface }]}>
                {(passportPhotoUri || user?.avatar_url) ? (
                  <Image
                    source={{ uri: passportPhotoUri ?? user?.avatar_url ?? '' }}
                    style={styles.passportPhoto}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.passportPhotoPlaceholder}>
                    <Ionicons name="camera-outline" size={40} color={colors.textSecondary} />
                    <ThemedText style={[styles.passportPhotoPlaceholderText, { color: colors.textSecondary }]}>
                      No photo
                    </ThemedText>
                  </View>
                )}
              </View>
              <StagePassButton
                title={uploadingPhoto ? 'Uploading…' : 'Upload photo'}
                onPress={handleUploadPassportPhoto}
                disabled={uploadingPhoto}
                variant="outline"
                style={styles.passportUploadBtn}
              />
            </View>
          </View>

          {/* Personal info card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="person-outline" size={20} color={themeYellow} />
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
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="keypad-outline" size={20} color={themeYellow} />
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
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="lock-closed-outline" size={20} color={themeYellow} />
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
          <Pressable
            style={({ pressed }) => [
              styles.logoutWrap,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <ThemedText style={[styles.logoutText, { color: colors.error }]}>Sign out</ThemedText>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 0,
  },
  hero: {
    paddingTop: Spacing.section,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  heroAvatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: Spacing.xs,
  },
  roleBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderRadius: BorderRadius.xl + 4,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  appearanceRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  appearanceOption: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appearanceOptionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  adminLinks: { marginTop: Spacing.xs },
  adminLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: 0,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  adminLinkLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  input: { marginBottom: Spacing.md },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.xs,
  },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 15, fontWeight: '600' },
  cardButton: { marginTop: Spacing.sm },
  passportPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  passportPhotoWrap: {
    width: 100,
    height: 130,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
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
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  passportUploadBtn: { flex: 1 },
  logoutWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  logoutText: { fontSize: 16, fontWeight: '600' },
});
