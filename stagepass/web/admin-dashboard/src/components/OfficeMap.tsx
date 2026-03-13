/**
 * Shows an embedded map (OpenStreetMap) when office latitude and longitude are set.
 * Used on Settings page for office geofence location.
 */
type OfficeMapProps = {
  latitude: number;
  longitude: number;
  radiusM?: number;
  className?: string;
};

export function OfficeMap({ latitude, longitude, radiusM = 30, className = '' }: OfficeMapProps) {
  const pad = 0.004 + (radiusM / 111000) * 2; // ~rough degrees for radius
  const minLon = longitude - pad;
  const minLat = latitude - pad;
  const maxLon = longitude + pad;
  const maxLat = latitude + pad;
  const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude},${longitude}`;

  return (
    <div className={className}>
      <p className="mb-2 text-sm font-medium text-slate-600">Office location (geofence centre)</p>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <iframe
          title="Office location map"
          src={embedUrl}
          className="h-[280px] w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        Crew can &quot;Check in office&quot; when within {radiusM} m of this point.
      </p>
    </div>
  );
}
