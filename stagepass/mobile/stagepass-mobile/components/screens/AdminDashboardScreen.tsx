import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { StagePassButton } from '@/components/StagePassButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, StagePassColors } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { useNavigationPress } from '@/src/utils/navigationPress';

/** Admin dashboard placeholder – full operational visibility */
export function AdminDashboardScreen() {
  const router = useRouter();
  const handleNav = useNavigationPress();
  const { colors, isDark } = useStagePassTheme();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={[styles.title, { color: StagePassColors.themeBlue }]}>
        Admin Dashboard
      </ThemedText>
      <ThemedText style={[styles.subtitle, { color: isDark ? '#F9FAFB' : '#0F172A' }]}>
        Today's events · Active events · Crew & check-in · Reported issues
      </ThemedText>
      <StagePassButton
        title="Events"
        onPress={() => handleNav(() => router.push('/(tabs)/events'))}
        variant="primary"
        style={styles.cta}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.xxl,
    paddingTop: Spacing.section,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: Spacing.xl,
  },
  cta: {
    marginBottom: Spacing.md,
  },
});
