import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, themeBlue } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api, type User } from '~/services/api';

export default function AdminUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useStagePassTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.users.list();
      setUsers(Array.isArray(res?.data) ? res.data : (res as any)?.data ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const bottomPad = insets.bottom + Spacing.xl;

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Users & Crew" />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeBlue} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeBlue} />
          }
        >
          {users.length === 0 ? (
            <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>
              No users found.
            </ThemedText>
          ) : (
            users.map((u) => (
              <View
                key={u.id}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <ThemedText style={[styles.name, { color: colors.text }]}>{u.name}</ThemedText>
                <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
                  {u.email} {u.username ? `· @${u.username}` : ''}
                </ThemedText>
                {u.roles?.length ? (
                  <ThemedText style={[styles.roles, { color: themeBlue }]}>
                    {u.roles.map((r) => r.name).join(', ')}
                  </ThemedText>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingTop: 0 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', paddingVertical: Spacing.xxl, fontSize: 15 },
  card: {
    padding: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  name: { fontSize: 17, fontWeight: '700', marginBottom: Spacing.xs },
  meta: { fontSize: 14, marginBottom: Spacing.xs },
  roles: { fontSize: 13, fontWeight: '600' },
});
