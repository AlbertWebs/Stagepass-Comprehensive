import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { AlertButton, AlertOptions, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { StagepassText } from '@/components/StagepassText';
import { themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

type AlertRequest = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
  prompt?: boolean;
};

const queue: AlertRequest[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export const AppAlert = {
  show(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    queue.push({ title, message, buttons, options });
    notify();
  },
  prompt(title: string, message?: string, buttons?: Array<{ text?: string; style?: AlertButton['style']; onPress?: (value?: string) => void }>) {
    queue.push({ title, message, buttons: buttons as AlertButton[], prompt: true });
    notify();
  },
};

export function AppAlertHost() {
  const { colors, isDark } = useStagePassTheme();
  const [current, setCurrent] = useState<AlertRequest | null>(queue[0] ?? null);
  const [input, setInput] = useState('');

  useEffect(() => {
    const update = () => setCurrent(queue[0] ?? null);
    listeners.add(update);
    update();
    return () => { listeners.delete(update); };
  }, []);

  const dismiss = (button?: AlertButton) => {
    queue.shift();
    notify();
    if (current?.prompt) (button?.onPress as ((value?: string) => void) | undefined)?.(input);
    else button?.onPress?.();
    setInput('');
  };

  const buttons = current?.buttons?.length ? current.buttons : [{ text: 'Got it' }];
  const success = /saved|success|updated|transferred|submitted|enabled|complete/i.test(current?.title ?? '');
  const destructive = buttons.some(button => button.style === 'destructive');

  return (
    <Modal visible={current != null} transparent animationType="none" statusBarTranslucent onRequestClose={() => {
      if (current?.options?.cancelable !== false) dismiss();
    }}>
      <View style={styles.overlay}>
        <Animated.View entering={FadeIn.duration(160)} style={StyleSheet.absoluteFill}>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.scrim]}
            onPress={() => { if (current?.options?.cancelable !== false) dismiss(); }}
            accessibilityLabel="Dismiss dialog"
          />
        </Animated.View>
        <Animated.View entering={FadeInDown.springify().damping(18).stiffness(180)} style={[styles.card, { backgroundColor: isDark ? '#171D2B' : '#FFFFFF', borderColor: colors.border }]}>
          <View style={styles.iconHalo}>
            <LinearGradient colors={['#FFE16A', themeYellow, '#F2A900']} style={styles.iconCircle}>
              <Ionicons name={success ? 'checkmark-circle-outline' : destructive ? 'alert-circle-outline' : 'information-circle-outline'} size={30} color={themeBlue} />
            </LinearGradient>
          </View>
          <StagepassText style={[styles.title, { color: colors.text }]}>{current?.title}</StagepassText>
          {current?.message ? (
            <ScrollView style={styles.messageScroll} contentContainerStyle={styles.messageContent}>
              <StagepassText style={[styles.message, { color: colors.textSecondary }]}>{current.message}</StagepassText>
            </ScrollView>
          ) : null}
          {current?.prompt ? (
            <TextInput
              value={input}
              onChangeText={setInput}
              keyboardType="decimal-pad"
              placeholder="Amount"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
          ) : null}
          <View style={styles.actions}>
            {buttons.map((button, index) => {
              const secondary = button.style === 'cancel' && buttons.length > 1;
              return (
                <Pressable
                  key={`${index}-${button.text}`}
                  onPress={() => dismiss(button)}
                  accessibilityRole="button"
                  style={[styles.action, secondary && { borderColor: colors.border, borderWidth: 1 }]}
                >
                  {secondary ? (
                    <StagepassText style={[styles.actionText, { color: colors.text }]}>{button.text ?? 'Cancel'}</StagepassText>
                  ) : (
                    <LinearGradient colors={button.style === 'destructive' ? ['#FCA5A5', '#F87171'] : ['#FFE16A', themeYellow, '#F2A900']} style={styles.actionGradient}>
                      <StagepassText style={styles.actionText}>{button.text ?? 'OK'}</StagepassText>
                    </LinearGradient>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  scrim: { backgroundColor: 'rgba(3,8,22,0.72)' },
  card: { width: '100%', maxWidth: 400, alignItems: 'center', borderRadius: 26, borderWidth: 1, padding: 24, elevation: 18, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  iconHalo: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(250,190,20,0.13)', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, lineHeight: 29, fontWeight: '800', textAlign: 'center' },
  messageScroll: { maxHeight: 240, alignSelf: 'stretch', marginTop: 9, marginBottom: 20 },
  messageContent: { alignItems: 'center' },
  message: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  actions: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 18 },
  input: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 14, fontSize: 16 },
  action: { flexGrow: 1, minWidth: '42%', minHeight: 52, borderRadius: 15, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  actionGradient: { width: '100%', minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  actionText: { fontSize: 14, fontWeight: '800', color: themeBlue, textAlign: 'center' },
});
