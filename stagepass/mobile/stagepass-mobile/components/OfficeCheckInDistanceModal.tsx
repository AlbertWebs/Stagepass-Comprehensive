import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { StagepassText } from '@/components/StagepassText';
import { themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

type Props = {
  visible: boolean;
  radiusMeters: number;
  onDismiss: () => void;
};

export function OfficeCheckInDistanceModal({ visible, radiusMeters, onDismiss }: Props) {
  const { colors, isDark } = useStagePassTheme();
  const surface = isDark ? '#171D2B' : '#FFFFFF';
  const text = isDark ? '#F8FAFC' : '#111827';
  const muted = isDark ? '#AAB5CA' : '#64748B';
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.09)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Animated.View entering={FadeIn.duration(190)} style={StyleSheet.absoluteFill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss location notice"
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3, 8, 22, 0.72)' }]}
            onPress={onDismiss}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.springify().damping(17).stiffness(170)}
          style={[styles.card, { backgroundColor: surface, borderColor: border }]}
        >
          <LinearGradient
            colors={isDark ? ['rgba(250, 190, 20, 0.17)', 'rgba(250, 190, 20, 0)'] : ['rgba(250, 190, 20, 0.19)', 'rgba(250, 190, 20, 0)']}
            style={styles.topGlow}
            pointerEvents="none"
          />

          <View style={styles.badgeArea}>
            <Animated.View entering={FadeInUp.delay(80).duration(350)} style={styles.ringOuter} />
            <View style={styles.ringInner}>
              <LinearGradient
                colors={['#FFD54A', themeYellow, '#F59E0B']}
                style={styles.iconBadge}
              >
                <Ionicons name="location" size={31} color={themeBlue} />
              </LinearGradient>
            </View>
            <View style={styles.pinDot} />
          </View>

          <View style={[styles.eyebrow, { backgroundColor: isDark ? 'rgba(250,190,20,0.12)' : 'rgba(245,158,11,0.12)' }]}>
            <View style={styles.eyebrowDot} />
            <StagepassText style={styles.eyebrowText}>LOCATION CHECK</StagepassText>
          </View>

          <StagepassText style={[styles.title, { color: text }]}>You’re outside the office</StagepassText>
          <StagepassText style={[styles.description, { color: muted }]}>
            Head to the office check-in area to record your attendance.
          </StagepassText>

          <View style={[styles.radiusCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.055)' : '#F8FAFC', borderColor: border }]}>
            <View style={[styles.radiusIcon, { backgroundColor: isDark ? 'rgba(250,190,20,0.14)' : 'rgba(245,158,11,0.14)' }]}>
              <Ionicons name="navigate-outline" size={18} color={isDark ? themeYellow : '#C47A00'} />
            </View>
            <View style={styles.radiusCopy}>
              <StagepassText style={[styles.radiusLabel, { color: muted }]}>CHECK-IN RADIUS</StagepassText>
              <StagepassText style={[styles.radiusValue, { color: text }]}>Within {radiusMeters} metres</StagepassText>
            </View>
            <Ionicons name="radio-outline" size={20} color={isDark ? themeYellow : '#C47A00'} />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onDismiss}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <LinearGradient colors={['#FFD329', themeYellow, '#F7AE00']} style={styles.buttonGradient}>
              <StagepassText style={styles.buttonText}>Got it</StagepassText>
              <Ionicons name="arrow-forward" size={19} color={themeBlue} />
            </LinearGradient>
          </Pressable>
          <StagepassText style={[styles.footer, { color: colors.textSecondary }]}>
            Your location helps verify on-site attendance.
          </StagepassText>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  card: {
    width: '100%', maxWidth: 400, overflow: 'hidden', alignItems: 'center',
    borderWidth: 1, borderRadius: 28, paddingHorizontal: 24, paddingTop: 26, paddingBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 26, shadowOffset: { width: 0, height: 14 }, elevation: 18,
  },
  topGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
  badgeArea: { width: 102, height: 102, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  ringOuter: { position: 'absolute', width: 98, height: 98, borderRadius: 49, borderWidth: 1, borderColor: 'rgba(250,190,20,0.25)' },
  ringInner: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(250,190,20,0.13)' },
  iconBadge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#F5B700', shadowOpacity: 0.36, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 7 },
  pinDot: { position: 'absolute', right: 5, top: 12, width: 12, height: 12, borderRadius: 6, backgroundColor: '#38BDF8', borderWidth: 2, borderColor: '#fff' },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6, marginBottom: 11 },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E7A900' },
  eyebrowText: { color: '#BA8100', fontSize: 10, fontWeight: '800', letterSpacing: 1.25 },
  title: { textAlign: 'center', fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.45 },
  description: { textAlign: 'center', fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 300 },
  radiusCard: { width: '100%', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 21, marginBottom: 18 },
  radiusIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radiusCopy: { flex: 1 },
  radiusLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.05 },
  radiusValue: { fontSize: 14, fontWeight: '700', marginTop: 3 },
  button: { width: '100%', borderRadius: 15, overflow: 'hidden' },
  buttonPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  buttonGradient: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { color: themeBlue, fontSize: 16, fontWeight: '800' },
  footer: { fontSize: 11, textAlign: 'center', marginTop: 13 },
});
