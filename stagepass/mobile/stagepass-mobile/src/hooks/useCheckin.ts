/**
 * useCheckin – get location, validate against event geofence (100m default), submit check-in.
 * Shows "You must be at the event location to check in." when outside range.
 */
import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import { api } from '../services/api';
import { useGeofence } from './useGeofence';

const DEFAULT_RADIUS_METERS = 100;

export function useCheckin() {
  const { checkCanCheckIn } = useGeofence();
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  const refreshLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocation(null);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      setLocation(null);
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const submitCheckin = useCallback(
    async (eventId: number, eventLat?: number | null, eventLon?: number | null, radiusMeters: number = DEFAULT_RADIUS_METERS) => {
      if (!location) {
        return { ok: false, error: 'Location not available. Enable GPS and try again.' };
      }
      const { allowed, message } = checkCanCheckIn(location, eventLat ?? null, eventLon ?? null, radiusMeters);
      if (!allowed) {
        return { ok: false, error: message };
      }
      setLoading(true);
      try {
        await api.attendance.checkin(eventId, location.latitude, location.longitude);
        return { ok: true, error: null };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Check-in failed.' };
      } finally {
        setLoading(false);
      }
    },
    [location, checkCanCheckIn]
  );

  return {
    location,
    locationLoading,
    loading,
    refreshLocation,
    submitCheckin,
    validateOnly: checkCanCheckIn,
    defaultRadius: DEFAULT_RADIUS_METERS,
  };
}
