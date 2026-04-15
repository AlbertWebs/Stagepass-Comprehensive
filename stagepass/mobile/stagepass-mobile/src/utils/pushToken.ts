/**
 * Device push token for the Stagepass API `fcm_token` field.
 * Prefers Expo Push Token (expo-notifications) so the Laravel backend can send via Expo Push API.
 * Falls back to the native device token (FCM/APNs) from getDevicePushTokenAsync when Expo token is unavailable.
 *
 * Requires expo-notifications and a physical device. Returns null if unavailable or permission denied.
 * In Expo Go (SDK 53+), Android push was removed; we skip loading expo-notifications to avoid runtime errors.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export async function getDevicePushTokenAsync(): Promise<string | null> {
  if (Constants.appOwnership === 'expo') return null;
  try {
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');

    if (!Device.isDevice) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    try {
      const expoToken = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId: String(projectId) } : undefined
      );
      if (expoToken?.data && typeof expoToken.data === 'string' && expoToken.data.length > 0) {
        return expoToken.data;
      }
    } catch {
      // Fall through to native token (e.g. non-EAS builds).
    }

    const { data } = await Notifications.getDevicePushTokenAsync();
    return typeof data === 'string' ? data : null;
  } catch {
    return null;
  }
}
