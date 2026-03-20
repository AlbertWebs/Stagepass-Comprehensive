import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeHeader } from '@/components/HomeHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import {
  api,
  DEFAULT_HOMEPAGE_PREFERENCES,
  HOMEPAGE_SECTION_KEYS,
  type HomepageSectionKey,
  type HomepagePreferences,
} from '~/services/api';
import { setUser } from '~/store/authSlice';
import { PREF_HOMEPAGE_PREFERENCES_LOCAL } from '~/constants/preferences';

const SECTION_LABELS: Record<HomepageSectionKey, string> = {
  upcoming_events: 'Upcoming Events',
  my_events: 'My Events',
  attendance_stats: 'Attendance Statistics',
  recent_activities: 'Recent Activities',
  assigned_tasks: 'Assigned Tasks',
  announcements: 'Announcements / Updates',
};

function normalizePrefs(prefs?: HomepagePreferences | null): HomepagePreferences {
  const base = DEFAULT_HOMEPAGE_PREFERENCES;
  if (!prefs) return base;
  const visibility = { ...base.visibility, ...(prefs.visibility ?? {}) } as HomepagePreferences['visibility'];
  const incoming = Array.isArray(prefs.order) ? prefs.order : [];
  const order: HomepageSectionKey[] = [];
  incoming.forEach((k) => {
    if (HOMEPAGE_SECTION_KEYS.includes(k) && !order.includes(k)) order.push(k);
  });
  HOMEPAGE_SECTION_KEYS.forEach((k) => {
    if (!order.includes(k)) order.push(k);
  });
  return {
    visibility,
    order,
    layout: prefs.layout === 'compact' ? 'compact' : 'comfortable',
  };
}

export default function PreferencesScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { colors, isDark } = useStagePassTheme();
  const user = useSelector((s: { auth: { user: { homepage_preferences?: HomepagePreferences } | null } }) => s.auth.user);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<HomepagePreferences>(() => normalizePrefs(user?.homepage_preferences));
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.homepage_preferences) {
      setPrefs(normalizePrefs(user.homepage_preferences));
    }
  }, [user?.homepage_preferences]);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(PREF_HOMEPAGE_PREFERENCES_LOCAL)
      .then((raw) => {
        if (!mounted || !raw || user?.homepage_preferences) return;
        try {
          const parsed = JSON.parse(raw) as HomepagePreferences;
          setPrefs(normalizePrefs(parsed));
        } catch {
          // ignore malformed local cache
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const orderedItems = useMemo(() => prefs.order, [prefs.order]);

  const persist = async (next: HomepagePreferences) => {
    setPrefs(next);
    setSaving(true);
    setSaveError(null);
    try {
      await AsyncStorage.setItem(PREF_HOMEPAGE_PREFERENCES_LOCAL, JSON.stringify(next));
    } catch {
      // ignore local cache write issues
    }
    try {
      const updated = await api.auth.updateProfile({ homepage_preferences: next });
      dispatch(setUser(updated));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Preferences saved locally only.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = async (key: HomepageSectionKey) => {
    const next: HomepagePreferences = {
      ...prefs,
      visibility: { ...prefs.visibility, [key]: !prefs.visibility[key] },
    };
    await persist(next);
  };

  const moveItem = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= orderedItems.length) return;
    const nextOrder = [...orderedItems];
    const tmp = nextOrder[index];
    nextOrder[index] = nextOrder[target];
    nextOrder[target] = tmp;
    await persist({ ...prefs, order: nextOrder });
  };

  const setLayout = async (layout: 'compact' | 'comfortable') => {
    if (prefs.layout === layout) return;
    await persist({ ...prefs, layout });
  };

  const cardBg = isDark ? '#1E212A' : '#F5F7FC';
  const accent = isDark ? themeYellow : themeBlue;

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="Preferences" showBack onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Homepage visibility</ThemedText>
          {orderedItems.map((key) => {
            const on = prefs.visibility[key];
            return (
              <Pressable
                key={key}
                onPress={() => toggleSection(key)}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: colors.border, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <ThemedText style={[styles.rowLabel, { color: colors.text }]}>{SECTION_LABELS[key]}</ThemedText>
                <Ionicons name={on ? 'toggle' : 'toggle-outline'} size={30} color={on ? accent : colors.textSecondary} />
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Section order</ThemedText>
          <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>
            Reorder homepage modules.
          </ThemedText>
          {orderedItems.map((key, index) => (
            <View key={key} style={[styles.row, { borderBottomColor: colors.border }]}>
              <ThemedText style={[styles.rowLabel, { color: colors.text }]}>{SECTION_LABELS[key]}</ThemedText>
              <View style={styles.rowActions}>
                <Pressable onPress={() => moveItem(index, -1)} style={styles.iconBtn}>
                  <Ionicons name="arrow-up" size={18} color={colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => moveItem(index, 1)} style={styles.iconBtn}>
                  <Ionicons name="arrow-down" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Layout</ThemedText>
          <View style={styles.layoutRow}>
            <Pressable
              onPress={() => setLayout('compact')}
              style={[
                styles.layoutBtn,
                {
                  backgroundColor: prefs.layout === 'compact' ? accent + '22' : 'transparent',
                  borderColor: prefs.layout === 'compact' ? accent : colors.border,
                },
              ]}
            >
              <ThemedText style={[styles.layoutText, { color: colors.text }]}>Compact</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setLayout('comfortable')}
              style={[
                styles.layoutBtn,
                {
                  backgroundColor: prefs.layout === 'comfortable' ? accent + '22' : 'transparent',
                  borderColor: prefs.layout === 'comfortable' ? accent : colors.border,
                },
              ]}
            >
              <ThemedText style={[styles.layoutText, { color: colors.text }]}>Comfortable</ThemedText>
            </Pressable>
          </View>
        </View>

        {saving ? (
          <ThemedText style={[styles.saving, { color: colors.textSecondary }]}>Saving changes…</ThemedText>
        ) : null}
        {saveError ? (
          <ThemedText style={[styles.saving, { color: colors.error }]}>
            {saveError}
          </ThemedText>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  card: { borderWidth: 1, borderRadius: 14, padding: Spacing.lg },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: Spacing.sm },
  hint: { fontSize: 12, marginBottom: Spacing.sm },
  row: {
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  rowLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  layoutRow: { flexDirection: 'row', gap: Spacing.sm },
  layoutBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoutText: { fontSize: 14, fontWeight: '700' },
  saving: { textAlign: 'center', fontSize: 12 },
});
