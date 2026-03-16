/**
 * Admin: Crew detail – view and update user/crew details.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { StagePassInput } from '@/components/StagePassInput';
import { StagePassButton } from '@/components/StagePassButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api, type User } from '~/services/api';

const U = { sm: 8, md: 12, lg: 16, xl: 20 };
const CARD_RADIUS = 14;

function roleLabel(name: string): string {
  const map: Record<string, string> = {
    super_admin: 'Super Admin',
    director: 'Director',
    admin: 'Admin',
    team_leader: 'Team Leader',
    accountant: 'Accountant',
    logistics: 'Logistics',
    operations: 'Operations',
    crew: 'Crew',
  };
  return map[name] ?? name;
}

export default function AdminCrewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useStagePassTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [rolesList, setRolesList] = useState<{ id: number; name: string }[]>([]);

  const userId = id ? parseInt(id, 10) : NaN;

  const loadUser = useCallback(async () => {
    if (!Number.isFinite(userId)) return;
    setLoading(true);
    try {
      const u = await api.users.get(userId);
      setUser(u);
      setName(u.name ?? '');
      setEmail(u.email ?? '');
      setUsername(u.username ?? '');
      setPhoneNumber(u.phone_number ?? (u as any).phone ?? '');
      setSelectedRoleIds(u.roles?.map((r) => r.id) ?? []);
    } catch {
      setUser(null);
      Alert.alert('Error', 'Could not load crew member.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [userId, router]);

  const loadRoles = useCallback(async () => {
    try {
      const res = await api.roles.list();
      const data = (res as any)?.data ?? res;
      setRolesList(Array.isArray(data) ? data : []);
    } catch {
      setRolesList([]);
    }
  }, []);

  useEffect(() => {
    loadUser();
    loadRoles();
  }, [loadUser, loadRoles]);

  const handleSave = async () => {
    if (!user || !Number.isFinite(userId)) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Invalid', 'Name is required.');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: trimmedName,
        email: email.trim() || undefined,
        username: username.trim() || undefined,
        phone: phoneNumber.trim() || undefined,
        role_ids: selectedRoleIds,
      };
      await api.users.update(userId, body as Partial<User>);
      setUser((prev) => (prev ? { ...prev, name: trimmedName, email: email.trim(), username: username.trim(), phone_number: phoneNumber.trim(), roles: rolesList.filter((r) => selectedRoleIds.includes(r.id)) } : null));
      setEditing(false);
      Alert.alert('Saved', 'Crew details updated.');
    } catch (e) {
      Alert.alert(
        'Update failed',
        e instanceof Error ? e.message : 'Could not update. Try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (roleId: number) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  if (loading || !user) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title={user?.name ?? 'Crew details'} showBack onBack={() => router.back()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={isDark ? themeYellow : themeBlue} />
        </View>
      </ThemedView>
    );
  }

  const bottomPad = insets.bottom + Spacing.xl;

  return (
    <ThemedView style={styles.container}>
      <AppHeader title={user.name} showBack onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: isDark ? 'transparent' : '#000', shadowOffset: isDark ? undefined : { width: 0, height: 1 }, shadowOpacity: isDark ? 0 : 0.06, shadowRadius: isDark ? 0 : 4, elevation: isDark ? 0 : 1 }]}>
            <View style={styles.cardHeader}>
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                {editing ? 'Edit details' : 'Details'}
              </ThemedText>
              {!editing ? (
                <Pressable onPress={() => setEditing(true)} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
                  <ThemedText style={[styles.editLink, { color: isDark ? themeYellow : themeBlue }]}>Edit</ThemedText>
                </Pressable>
              ) : null}
            </View>

            {editing ? (
              <>
                <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Name</ThemedText>
                <StagePassInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Full name"
                  autoCapitalize="words"
                  style={styles.input}
                />
                <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Email</ThemedText>
                <StagePassInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Username</ThemedText>
                <StagePassInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Login username"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Phone</ThemedText>
                <StagePassInput
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="Phone number"
                  keyboardType="phone-pad"
                  style={styles.input}
                />
                {rolesList.length > 0 && (
                  <>
                    <ThemedText style={[styles.label, { color: colors.textSecondary, marginTop: U.sm }]}>Roles</ThemedText>
                    <View style={styles.rolesRow}>
                      {rolesList.map((r) => {
                        const selected = selectedRoleIds.includes(r.id);
                        return (
                          <Pressable
                            key={r.id}
                            onPress={() => toggleRole(r.id)}
                            style={[
                              styles.roleChip,
                              { backgroundColor: selected ? (isDark ? themeYellow + '28' : themeBlue + '18') : colors.inputBackground, borderColor: selected ? (isDark ? themeYellow : themeBlue) : colors.border },
                            ]}
                          >
                            <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={18} color={selected ? (isDark ? themeYellow : themeBlue) : colors.textSecondary} />
                            <ThemedText style={[styles.roleChipText, { color: selected ? (isDark ? themeYellow : themeBlue) : colors.text }]}>{roleLabel(r.name)}</ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}
                <View style={styles.actions}>
                  <View style={styles.actionsRow}>
                    <View style={styles.actionsButton}>
                      <StagePassButton title={saving ? 'Saving…' : 'Save changes'} onPress={handleSave} loading={saving} variant="primary" />
                    </View>
                    <View style={styles.actionsButton}>
                      <StagePassButton title="Cancel" onPress={() => setEditing(false)} variant="outline" disabled={saving} />
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.row, styles.rowView, { borderBottomColor: colors.border }]}>
                  <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name</ThemedText>
                  <ThemedText style={[styles.fieldValue, { color: colors.text }]}>{user.name || '—'}</ThemedText>
                </View>
                <View style={[styles.row, styles.rowView, { borderBottomColor: colors.border }]}>
                  <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email</ThemedText>
                  <ThemedText style={[styles.fieldValue, { color: colors.text }]}>{user.email || '—'}</ThemedText>
                </View>
                <View style={[styles.row, styles.rowView, { borderBottomColor: colors.border }]}>
                  <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Username</ThemedText>
                  <ThemedText style={[styles.fieldValue, { color: colors.text }]}>{user.username ? `@${user.username}` : '—'}</ThemedText>
                </View>
                <View style={[styles.row, styles.rowView, { borderBottomColor: colors.border }]}>
                  <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Phone</ThemedText>
                  <ThemedText style={[styles.fieldValue, { color: colors.text }]}>{user.phone_number ?? (user as any).phone ?? '—'}</ThemedText>
                </View>
                {user.staff_id && (
                  <View style={[styles.row, styles.rowView, { borderBottomColor: colors.border }]}>
                    <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Staff ID</ThemedText>
                    <ThemedText style={[styles.fieldValue, { color: colors.text }]}>{user.staff_id}</ThemedText>
                  </View>
                )}
                {user.roles?.length ? (
                  <View style={[styles.row, styles.rowView, { borderBottomColor: colors.border }]}>
                    <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Roles</ThemedText>
                    <ThemedText style={[styles.fieldValue, { color: colors.text }]}>
                      {user.roles.map((r) => roleLabel(r.name)).join(', ')}
                    </ThemedText>
                  </View>
                ) : null}
                {user.is_permanent_employee !== undefined && (
                  <View style={[styles.row, styles.rowViewLast]}>
                    <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Permanent employee</ThemedText>
                    <ThemedText style={[styles.fieldValue, { color: colors.text }]}>{user.is_permanent_employee ? 'Yes' : 'No'}</ThemedText>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    padding: U.xl,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: U.lg,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  editLink: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  input: { marginBottom: U.md },
  row: { marginBottom: 0 },
  rowView: { paddingVertical: U.md, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 0 },
  rowViewLast: { paddingVertical: U.md, marginBottom: 0 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  fieldValue: { fontSize: 15 },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: U.sm, marginBottom: U.md },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  roleChipText: { fontSize: 13, fontWeight: '600' },
  actions: { marginTop: U.xl },
  actionsRow: { flexDirection: 'row', gap: U.md },
  actionsButton: { flex: 1 },
});
