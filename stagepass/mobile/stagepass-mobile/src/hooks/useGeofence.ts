import { useCallback, useState } from 'react';
import { isWithinGeofence } from '../utils/geofence';

export type Location = { latitude: number; longitude: number };

export function useGeofence() {
  const [locationError, setLocationError] = useState<string | null>(null);

  const checkCanCheckIn = useCallback(
    (
      userLocation: Location | null,
      eventLat: number | null | undefined,
      eventLon: number | null | undefined,
      radiusMeters: number
    ): { allowed: boolean; message: string } => {
      if (!userLocation) {
        return { allowed: false, message: 'Location not available. Enable GPS and try again.' };
      }
      if (eventLat == null || eventLon == null) {
        return {
          allowed: false,
          message: 'Event location is not set. Geofence check-in is required. Ask the organizer to set the event location.',
        };
      }
      const inside = isWithinGeofence(
        userLocation.latitude,
        userLocation.longitude,
        eventLat,
        eventLon,
        radiusMeters
      );
      return inside
        ? { allowed: true, message: 'You are within the event area.' }
        : {
            allowed: false,
            message: 'You must be at the event location to check in.',
          };
    },
    []
  );

  return { checkCanCheckIn, locationError, setLocationError };
}
