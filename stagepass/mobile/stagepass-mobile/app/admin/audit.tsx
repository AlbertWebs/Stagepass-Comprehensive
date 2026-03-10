import { StyleSheet, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

export default function AdminAuditScreen() {
  const { colors } = useStagePassTheme();
  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Audit logs" />
      <View style={styles.content}>
        <ThemedText style={{ color: colors.textSecondary }}>Audit logs — content can be added here.</ThemedText>
      </View>
    </ThemedView>
  );
}
const styles = StyleSheet.create({ container: { flex: 1 }, content: { padding: Spacing.lg } });