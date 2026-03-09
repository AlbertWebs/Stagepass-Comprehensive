/**
 * Admin dashboard – Events (CRUD), Crew, Operations, Payments.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { Pressable } from 'react-native';

const cards = [
  {
    id: 'events',
    title: 'Events',
    subtitle: 'Create, edit, delete events',
    icon: 'calendar' as const,
    href: '/admin/events',
    color: themeBlue,
  },
  {
    id: 'crew',
    title: 'Crew',
    subtitle: 'Assignment & scheduling',
    icon: 'people' as const,
    href: '/admin/events',
    color: themeYellow,
  },
  {
    id: 'operations',
    title: 'Operations',
    subtitle: 'Task & checklist status',
    icon: 'checkbox' as const,
    href: '/admin/events',
    color: themeBlue,
  },
  {
    id: 'payments',
    title: 'Payments',
    subtitle: 'Request payment',
    icon: 'card' as const,
    href: '/admin/payments/request',
    color: themeYellow,
  },
];

export default function AdminDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useStagePassTheme();

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Admin" />
      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}>
        <ThemedText style={[styles.intro, { color: colors.textSecondary }]}>
          Manage events, crew, operations, and payments
        </ThemedText>
        {cards.map((card) => (
          <Pressable
            key={card.id}
            onPress={() => {
              if (card.id === 'crew' || card.id === 'operations') {
                router.push('/admin/events' as any);
              } else {
                router.push(card.href as any);
              }
            }}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: card.color + '22' }]}>
              <Ionicons name={card.icon} size={28} color={card.color} />
            </View>
            <View style={styles.cardBody}>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>{card.title}</ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>{card.subtitle}</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={themeYellow} />
          </Pressable>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: Spacing.lg },
  intro: {
    fontSize: 14,
    marginBottom: Spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  cardSub: { fontSize: 13 },
});
