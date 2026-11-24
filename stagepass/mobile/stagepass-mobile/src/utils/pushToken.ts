/**
 * Native push token for the Stagepass API `fcm_token` field.
 * Android registers an FCM token through expo-notifications. iOS uses Firebase
 * Messaging so the API receives an FCM token (not the raw APNs token).
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

    if (Platform.OS === 'ios') {
      const firebaseMessaging = await import('@react-native-firebase/messaging');
      return await firebaseMessaging.getToken(firebaseMessaging.getMessaging());
    }

    const { data } = await Notifications.getDevicePushTokenAsync();
    return typeof data === 'string' ? data : null;
  } catch {
    return null;
  }
}
