/**
 * Admin/team leader: send a message to all crew or selected crew members.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Event as EventType } from '~/services/api';
import { AppHeader } from '@/components/AppHeader';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

type CrewMember = { id: number; name: string };

export default function EventMessageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const eventId = id ? Number(id) : 0;
  const [event, setEvent] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sendToAll, setSendToAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);

  const crew: CrewMember[] = (event?.crew ?? []).map((c) => ({ id: c.id, name: c.name }));

  const loadEvent = useCallback(async () => {
    if (!eventId) return;
    try {
      const e = await api.events.get(eventId);
      setEvent(e);
    } catch {
      Alert.alert('Error', 'Failed to load event.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const toggleMember = (userId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSend = async () => {
    const text = message.trim();
    if (!text) {
      Alert.alert('Required', 'Please enter a message.');
      return;
    }
    if (!sendToAll && selectedIds.size === 0) {
      Alert.alert('Select recipients', 'Choose "All crew" or select at least one crew member.');
      return;
    }
    setSending(true);
    try {
      if (sendToAll) {
        await api.events.eventMessage(eventId, { target: 'all', message: text });
        Alert.alert('Sent', 'Message sent to all crew.', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        for (const userId of selectedIds) {
          await api.events.eventMessage(eventId, { target: 'user', user_id: userId, message: text });
        }
        Alert.alert('Sent', `Message sent to ${selectedIds.size} crew member(s).`, [{ text: 'OK', onPress: () => router.back() }]);
      }
      setMessage('');
    } catch (e) {
      Alert.alert('Failed', e instanceof Error ? e.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  if (loading || !event) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Message crew" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeYellow} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>Loading…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader title={`Message: ${event.name}`} showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Message</ThemedText>
          <StagePassInput
            value={message}
            onChangeText={setMessage}
            placeholder="Type your message to crew…"
            multiline
            numberOfLines={4}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Send to</ThemedText>
          </View>

          <Pressable
            onPress={() => { setSendToAll(true); setSelectedIds(new Set()); }}
            style={[styles.optionRow, { borderBottomColor: colors.border }]}
          >
            <View style={[styles.radio, sendToAll && styles.radioSelected]}>
              {sendToAll && <View style={[styles.radioInner, { backgroundColor: themeYellow }]} />}
            </View>
            <Ionicons name="people" size={22} color={sendToAll ? themeYellow : colors.textSecondary} />
            <ThemedText style={[styles.optionLabel, { color: colors.text }]}>All crew ({crew.length})</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setSendToAll(false)}
            style={[styles.optionRow, { borderBottomColor: colors.border }]}
          >
            <View style={[styles.radio, !sendToAll && styles.radioSelected]}>
              {!sendToAll && <View style={[styles.radioInner, { backgroundColor: themeYellow }]} />}
            </View>
            <Ionicons name="person" size={22} color={!sendToAll ? themeYellow : colors.textSecondary} />
            <ThemedText style={[styles.optionLabel, { color: colors.text }]}>Select members</ThemedText>
          </Pressable>
        </View>

        {!sendToAll && crew.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Crew members</ThemedText>
            </View>
            <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>
              Tap to select who will receive the message.
            </ThemedText>
            {crew.map((member) => {
              const selected = selectedIds.has(member.id);
              return (
                <Pressable
                  key={member.id}
                  onPress={() => toggleMember(member.id)}
                  style={[styles.memberRow, { borderBottomColor: colors.border }]}
                >
                  <View style={[styles.checkbox, selected && { backgroundColor: themeYellow, borderColor: themeYellow }]}>
                    {selected && <Ionicons name="checkmark" size={16} color="#0f1838" />}
                  </View>
                  <ThemedText style={[styles.memberName, { color: colors.text }]}>{member.name}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          onPress={handleSend}
          disabled={sending || !message.trim() || (!sendToAll && selectedIds.size === 0)}
          style={[
            styles.sendBtn,
            { backgroundColor: themeYellow },
            (sending || !message.trim() || (!sendToAll && selectedIds.size === 0)) && { opacity: 0.6 },
          ]}
        >
          {sending ? (
            <ActivityIndicator size="small" color={themeBlue} />
          ) : (
            <ThemedText style={[styles.sendBtnText, { color: themeBlue }]}>
              Send message{sendToAll ? ' to all' : ` to ${selectedIds.size}`}
            </ThemedText>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ThemedText style={[styles.backBtnText, { color: colors.brandText }]}>Cancel</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loadingText: { fontSize: 15 },
  scroll: { padding: Spacing.lg },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  label: { fontSize: 14, fontWeight: '600', marginBottom: Spacing.xs },
  input: { minHeight: 100, textAlignVertical: 'top' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitleAccent: { width: 3, height: 16, borderRadius: 0 },
  sectionTitle: { fontSize: 17, fontWeight: '700', flex: 1 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: { borderColor: themeYellow },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  optionLabel: { fontSize: 16, fontWeight: '600', flex: 1 },
  hint: { fontSize: 13, marginBottom: Spacing.sm },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberName: { fontSize: 16, flex: 1 },
  sendBtn: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sendBtnText: { fontSize: 16, fontWeight: '700' },
  backBtn: { alignSelf: 'center', paddingVertical: Spacing.md },
  backBtnText: { fontSize: 16, fontWeight: '600' },
});
