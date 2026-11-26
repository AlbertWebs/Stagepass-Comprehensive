import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { StagepassText } from '@/components/StagepassText';
import { themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

type Props = {
  visible: boolean;
  eventName: string;
  message?: string | null;
  onDismiss: () => void;
  onConfirm: () => void;
};

export function EventCheckOutModal({ visible, eventName, message, onDismiss, onConfirm }: Props) {
  const { colors, isDark } = useStagePassTheme();
  const isNotice = Boolean(message);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
          <Pressable style={[StyleSheet.absoluteFill, styles.scrim]} onPress={onDismiss} accessibilityLabel="Dismiss checkout dialog" />
        </Animated.View>
        <Animated.View entering={FadeInDown.springify().damping(18).stiffness(170)} style={[styles.card, { backgroundColor: isDark ? '#171D2B' : '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.iconHalo}>
            <LinearGradient colors={['#FFE16A', themeYellow, '#F2A900']} style={styles.iconCircle}>
              <Ionicons name={isNotice ? 'alert-circle-outline' : 'exit-outline'} size={28} color={themeBlue} />
            </LinearGradient>
          </View>
          <StagepassText style={[styles.eyebrow, { color: themeYellow }]}>EVENT SHIFT</StagepassText>
          <StagepassText style={[styles.title, { color: colors.text }]}>{isNotice ? 'Cannot check out' : 'End your shift?'}</StagepassText>
          <StagepassText style={[styles.description, { color: colors.textSecondary }]}>
            {message ?? `Check out of ${eventName}? Your shift time will be recorded.`}
          </StagepassText>
          <View style={styles.actions}>
            {!isNotice ? (
              <Pressable onPress={onDismiss} style={[styles.cancelButton, { borderColor: colors.border }]} accessibilityRole="button">
                <StagepassText style={[styles.cancelText, { color: colors.text }]}>Keep working</StagepassText>
              </Pressable>
            ) : null}
            <Pressable onPress={isNotice ? onDismiss : onConfirm} style={styles.confirmButton} accessibilityRole="button">
              <LinearGradient colors={['#FFE16A', themeYellow, '#F2A900']} style={styles.confirmGradient}>
                <StagepassText style={styles.confirmText}>{isNotice ? 'Got it' : 'Check out'}</StagepassText>
                <Ionicons name={isNotice ? 'arrow-forward' : 'checkmark'} size={18} color={themeBlue} />
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  scrim: { backgroundColor: 'rgba(3,8,22,0.72)' },
  card: { width: '100%', maxWidth: 400, borderRadius: 26, borderWidth: 1, padding: 24, alignItems: 'center', overflow: 'hidden', elevation: 18, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  iconHalo: { width: 82, height: 82, borderRadius: 41, backgroundColor: 'rgba(250,190,20,0.13)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 8 },
  title: { fontSize: 23, lineHeight: 30, fontWeight: '800', textAlign: 'center' },
  description: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 9, marginBottom: 22 },
  actions: { width: '100%', flexDirection: 'row', gap: 10 },
  cancelButton: { flex: 1, minHeight: 52, borderRadius: 15, borderWidth: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  cancelText: { fontSize: 14, fontWeight: '700' },
  confirmButton: { flex: 1, borderRadius: 15, overflow: 'hidden' },
  confirmGradient: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  confirmText: { fontSize: 14, fontWeight: '800', color: themeBlue },
});
