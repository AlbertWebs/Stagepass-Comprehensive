import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, themeBlue } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api, type Communication } from '~/services/api';

export default function AdminCommunicationsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useStagePassTheme();
  const [list, setList] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.communications.list();
      const data = (res as any)?.data ?? res?.data;
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
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
      <AppHeader title="Communication" />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeBlue} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeBlue} />}
        >
          {list.length === 0 ? (
            <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>No communications.</ThemedText>
          ) : (
            list.map((c) => (
              <View key={c.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ThemedText style={[styles.title, { color: colors.text }]}>{c.title}</ThemedText>
                {c.body ? (
                  <ThemedText style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={3}>
                    {c.body}
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
  card: { padding: Spacing.lg, borderRadius: 12, borderWidth: 1, marginBottom: Spacing.md },
  title: { fontSize: 17, fontWeight: '700', marginBottom: Spacing.xs },
  meta: { fontSize: 14 },
});
