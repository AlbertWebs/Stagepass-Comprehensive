import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { HomeHeader } from '@/components/HomeHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Cards, Typography } from '@/constants/ui';
import { Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { NAV_PRESSED_OPACITY } from '@/src/utils/navigationPress';
import { api, type Communication } from '~/services/api';

const TAB_BAR_HEIGHT = 58;

function readStoreKey(userId?: number) {
  return `@stagepass/messages-read/${userId ?? 'anon'}`;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { colors, isDark } = useStagePassTheme();
  const userId = useSelector((s: { auth: { user: { id?: number } | null } }) => s.auth.user?.id);
  const [animateKey, setAnimateKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Communication[]>([]);
  const [readIds, setReadIds] = useState<number[]>([]);
  const [showUnreadOnly, setShowUnreadOnly] = useState(true);

  const load = useCallback(async () => {
    try {
      const [commRes, stored] = await Promise.all([
        api.communications.list(),
        AsyncStorage.getItem(readStoreKey(userId)),
      ]);
      const list = Array.isArray(commRes?.data) ? commRes.data : [];
      setItems(list);
      const parsed = stored ? (JSON.parse(stored) as number[]) : [];
      setReadIds(Array.isArray(parsed) ? parsed : []);
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setAnimateKey((k) => k + 1);
      load();
    }, [load])
  );

  const unreadCount = useMemo(
    () => items.reduce((acc, item) => acc + (readIds.includes(item.id) ? 0 : 1), 0),
    [items, readIds]
  );

  const visibleItems = useMemo(
    () => (showUnreadOnly ? items.filter((i) => !readIds.includes(i.id)) : items),
    [showUnreadOnly, items, readIds]
  );

  const persistRead = useCallback(
    async (next: number[]) => {
      setReadIds(next);
      await AsyncStorage.setItem(readStoreKey(userId), JSON.stringify(next));
    },
    [userId]
  );

  const markOneRead = useCallback(
    async (id: number) => {
      if (readIds.includes(id)) return;
      await persistRead([...readIds, id]);
    },
    [readIds, persistRead]
  );

  const markAllRead = useCallback(async () => {
    const allIds = items.map((i) => i.id);
    await persistRead(allIds);
  }, [items, persistRead]);

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="Messages" notificationCount={unreadCount} />
      <Animated.View key={animateKey} entering={SlideInRight.duration(320)} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_HEIGHT + Spacing.section }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={isDark ? themeYellow : themeBlue}
            />
          }
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => setShowUnreadOnly((v) => !v)}
              style={({ pressed }) => [
                styles.filterBtn,
                { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? NAV_PRESSED_OPACITY : 1 },
              ]}
            >
              <Ionicons name={showUnreadOnly ? 'mail-unread-outline' : 'mail-outline'} size={16} color={isDark ? themeYellow : themeBlue} />
              <ThemedText style={[styles.filterBtnText, { color: colors.text }]}>
                {showUnreadOnly ? 'Unread only' : 'All messages'}
              </ThemedText>
            </Pressable>
            <Pressable onPress={markAllRead} style={({ pressed }) => [styles.markAllBtn, pressed && { opacity: NAV_PRESSED_OPACITY }]}>
              <ThemedText style={[styles.markAllText, { color: isDark ? themeYellow : themeBlue }]}>Mark all read</ThemedText>
            </Pressable>
          </View>

          {visibleItems.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="mail-open-outline" size={24} color={colors.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                {showUnreadOnly ? 'No unread messages.' : 'No messages yet.'}
              </ThemedText>
            </View>
          ) : (
            visibleItems.map((msg) => {
              const isRead = readIds.includes(msg.id);
              return (
                <Pressable
                  key={msg.id}
                  onPress={() => markOneRead(msg.id)}
                  style={({ pressed }) => [
                    styles.card,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isRead ? colors.border : themeYellow + '99',
                      opacity: pressed ? NAV_PRESSED_OPACITY : 1,
                    },
                  ]}
                >
                  <View style={styles.cardHead}>
                    <ThemedText style={[styles.subject, { color: colors.text }]} numberOfLines={1}>
                      {msg.subject || 'Message'}
                    </ThemedText>
                    {!isRead ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <ThemedText style={[styles.body, { color: colors.textSecondary }]}>{msg.body || ''}</ThemedText>
                  <View style={styles.metaRow}>
                    <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
                      {msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}
                    </ThemedText>
                    {!isRead ? (
                      <ThemedText style={[styles.meta, { color: isDark ? themeYellow : themeBlue }]}>Tap to mark read</ThemedText>
                    ) : (
                      <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>Read</ThemedText>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Cards.borderRadius,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  filterBtnText: { fontSize: Typography.bodySmall, fontWeight: Typography.buttonTextWeight },
  markAllBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  markAllText: { fontSize: Typography.bodySmall, fontWeight: Typography.buttonTextWeight },
  emptyCard: {
    borderWidth: 1,
    borderRadius: Cards.borderRadius,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: { fontSize: Typography.bodySmall },
  card: {
    borderWidth: 1,
    borderRadius: Cards.borderRadius,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  subject: { flex: 1, fontSize: Typography.buttonText, fontWeight: Typography.buttonTextWeight },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  body: { fontSize: Typography.bodySmall, lineHeight: 18 },
  metaRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: Typography.titleSection },
});
