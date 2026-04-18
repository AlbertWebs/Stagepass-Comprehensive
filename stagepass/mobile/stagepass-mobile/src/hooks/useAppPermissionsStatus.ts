import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

export type PermissionKind = 'granted' | 'denied' | 'undetermined' | 'limited' | 'unavailable';

export type AppPermissionRow = {
  id: string;
  title: string;
  subtitle: string;
  status: PermissionKind;
};

function mapPermissionStatus(status: string | undefined): PermissionKind {
  if (status === 'granted') return 'granted';
  if (status === 'limited') return 'limited';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export function useAppPermissionsStatus() {
  const [rows, setRows] = useState<AppPermissionRow[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (Platform.OS === 'web') {
      setRows([
        {
          id: 'location',
          title: 'Location',
          subtitle: 'Event check-in and geofence',
          status: 'unavailable',
        },
        {
          id: 'notifications',
          title: 'Notifications',
          subtitle: 'Alerts and updates',
          status: 'unavailable',
        },
        {
          id: 'camera',
          title: 'Camera',
          subtitle: 'Profile photo',
          status: 'unavailable',
        },
        {
          id: 'photos',
          title: 'Photos',
          subtitle: 'Choose images from your library',
          status: 'unavailable',
        },
      ]);
      setHint('On web, OS permissions are not used the same way as on the mobile app.');
      return;
    }

    setHint(null);
    const expoGo = isRunningInExpoGo() || Constants.appOwnership === 'expo';

    let locationStatus: PermissionKind = 'undetermined';
    try {
      const loc = await Location.getForegroundPermissionsAsync();
      locationStatus = mapPermissionStatus(loc.status);
    } catch {
      locationStatus = 'unavailable';
    }

    let notificationStatus: PermissionKind = 'unavailable';
    if (!expoGo) {
      try {
        const { getPermissionsAsync } = await import('expo-notifications');
        const n = await getPermissionsAsync();
        notificationStatus = mapPermissionStatus(n.status);
      } catch {
        notificationStatus = 'unavailable';
      }
    } else {
      setHint(
        'Expo Go limits some permission checks. Use a development build to see full notification status.'
      );
    }

    let cameraStatus: PermissionKind = 'undetermined';
    let photosStatus: PermissionKind = 'undetermined';
    try {
      const cam = await ImagePicker.getCameraPermissionsAsync();
      cameraStatus = mapPermissionStatus(cam.status);
    } catch {
      cameraStatus = 'unavailable';
    }
    try {
      const lib = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (lib.status === 'granted' && lib.accessPrivileges === 'limited') {
        photosStatus = 'limited';
      } else {
        photosStatus = mapPermissionStatus(lib.status);
      }
    } catch {
      photosStatus = 'unavailable';
    }

    setRows([
      {
        id: 'location',
        title: 'Location',
        subtitle: 'Event check-in and geofence',
        status: locationStatus,
      },
      {
        id: 'notifications',
        title: 'Notifications',
        subtitle: 'Alerts and updates',
        status: notificationStatus,
      },
      {
        id: 'camera',
        title: 'Camera',
        subtitle: 'Profile photo',
        status: cameraStatus,
      },
      {
        id: 'photos',
        title: 'Photos',
        subtitle: 'Choose images from your library',
        status: photosStatus,
      },
    ]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return { rows, hint, refresh };
}
