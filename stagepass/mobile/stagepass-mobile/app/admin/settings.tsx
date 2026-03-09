import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, themeBlue } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api } from '~/services/api';

export default function AdminSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useStagePassTheme();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.settings.get();
      setData(res && typeof res === 'object' ? res : null);
    } catch {
      setData(null);
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
      <AppHeader title="Settings" />
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
          {data && Object.keys(data).length > 0 ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.json, { color: colors.text }]}>{JSON.stringify(data, null, 2)}</ThemedText>
            </View>
          ) : (
            <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>No settings or failed to load.</ThemedText>
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
  card: { padding: Spacing.lg, borderRadius: 12, borderWidth: 1 },
  json: { fontSize: 12, fontFamily: 'monospace' },
});
