/**
 * Shared header for main app: optional title (no favicon), support, notifications, logout.
 * Use on Home and other tab pages (Events, Activity, Profile). App icon is only for the installed app.
 */
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from '@/components/themed-text';
import { themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api } from '~/services/api';
import { logout } from '~/store/authSlice';
import { clearStoredToken } from '~/store/persistAuth';

const SUPPORT_WHATSAPP = process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? '';

export interface HomeHeaderProps {
  /** Page title shown in center. Default "Home". */
  title?: string;
}

export function HomeHeader({ title = 'Home' }: HomeHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useDispatch();
  const { colors, isDark } = useStagePassTheme();
  const paddingTop = Math.max(insets.top, 12);
  const chatOutlineColor = isDark ? themeYellow : themeBlue;
  const chatIconColor = themeYellow;

  const handleLogout = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.auth.logout();
          } catch {
            // ignore
          }
          await clearStoredToken();
          dispatch(logout());
          router.replace('/login');
        },
      },
    ]);
  }, [dispatch, router]);

  const handleSupportPress = async () => {
    const raw = SUPPORT_WHATSAPP.trim();
    if (!raw) {
      Alert.alert('Support unavailable', 'Support WhatsApp number is not configured yet.');
      return;
    }
    const phone = raw.replace(/[^+\d]/g, '');
    const waUrl = `whatsapp://send?phone=${phone}`;
    const webUrl = `https://wa.me/${encodeURIComponent(phone)}`;
    try {
      const canOpen = await Linking.canOpenURL(waUrl);
      if (canOpen) {
        await Linking.openURL(waUrl);
        return;
      }
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert('Cannot open WhatsApp', 'Please check WhatsApp is installed or try again later.');
    }
  };

  return (
    <View style={[styles.outer, { paddingTop, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.bar}>
        <Pressable
          onPress={handleSupportPress}
          style={({ pressed }) => [
            styles.iconBtn,
            styles.iconBtnOutline,
            { borderColor: chatOutlineColor },
            pressed && styles.iconBtnPressed,
          ]}
          accessibilityLabel="Chat support"
        >
          <Ionicons name="chatbubbles-outline" size={22} color={chatIconColor} />
        </Pressable>
        <View style={styles.titleWrap}>
          <ThemedText style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </ThemedText>
        </View>
        <View style={styles.rightRow}>
          <Pressable
            onPress={() => router.push('/(tabs)/activity')}
            style={({ pressed }) => [
              styles.iconBtn,
              styles.iconBtnOutline,
              { borderColor: isDark ? themeYellow : themeBlue },
              pressed && styles.iconBtnPressed,
            ]}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={24} color={themeYellow} />
          </Pressable>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.iconBtn,
              styles.iconBtnOutline,
              { borderColor: isDark ? themeYellow : themeBlue },
              pressed && styles.iconBtnPressed,
            ]}
            accessibilityLabel="Sign out"
          >
            <Ionicons name="log-out-outline" size={22} color={themeYellow} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.25,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnOutline: {
    borderWidth: 1.5,
  },
  iconBtnPressed: {
    opacity: 0.7,
  },
});
