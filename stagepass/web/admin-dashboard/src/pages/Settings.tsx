import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';
import { LocationSearchInput } from '@/components/LocationSearchInput';
import { OfficeMap } from '@/components/OfficeMap';
import { useAuth } from '@/contexts/AuthContext';

export type AppSettings = Record<string, string | number | boolean | null>;

const TIMEZONES = [
  'Africa/Nairobi',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'UTC',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
];

const DATE_FORMATS = [
  { value: 'd/m/Y', label: 'DD/MM/YYYY' },
  { value: 'm/d/Y', label: 'MM/DD/YYYY' },
  { value: 'Y-m-d', label: 'YYYY-MM-DD' },
];

const TIME_FORMATS = [
  { value: 'H:i', label: '24-hour (e.g. 14:30)' },
  { value: 'h:i A', label: '12-hour (e.g. 2:30 PM)' },
];

const EQUIPMENT_CONDITIONS = [
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'out_of_service', label: 'Out of service' },
];

const EVENT_STATUSES = [
  { value: 'created', label: 'Created' },
  { value: 'active', label: 'Active' },
];

const DEFAULTS: AppSettings = {
  app_name: 'Stagepass',
  company_name: 'Stagepass',
  app_support_email: '',
  support_phone: '',
  support_whatsapp_phone: '',
  timezone: 'Africa/Nairobi',
  date_format: 'd/m/Y',
  time_format: 'H:i',
  default_geofence_radius_m: 100,
  default_event_start_time: '09:00',
  default_event_end_time: '18:00',
  checkin_allowed_minutes_before: 60,
  notifications_email_enabled: true,
  notifications_sms_enabled: false,
  reminder_lead_hours: 24,
  default_equipment_condition: 'good',
  default_event_status: 'created',
  items_per_page: 20,
  allow_crew_self_checkin: true,
  require_geofence_for_checkin: true,
  payment_currency: 'KES',
  allow_time_off_requests: true,
  allow_biometric_mobile_login: true,
  office_location_name: '',
  office_latitude: '',
  office_longitude: '',
  office_radius_m: 100,
  office_checkin_start_time: '09:00',
  office_checkin_end_time: '10:00',
};

function getBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v === '1' || v === 1) return true;
  return false;
}

function getStr(v: unknown): string {
  if (v == null) return '';
  return String(v);
}

function getNum(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function parseCoord(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [pageReady, setPageReady] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULTS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [canEditSettings, setCanEditSettings] = useState(false);

  useEffect(() => {
    if (user) {
      setPageReady(true);
      setName(user.name ?? '');
      setEmail(user.email ?? '');
      const canEdit = user.roles?.some((r) => r.name === 'super_admin' || r.name === 'director' || r.name === 'admin');
      setCanEditSettings(!!canEdit);
      if (canEdit) {
        api.settings
          .get()
          .then((data) => setAppSettings((prev) => ({ ...DEFAULTS, ...prev, ...data })))
          .catch(() => setAppSettings(DEFAULTS))
          .finally(() => setSettingsLoading(false));
      } else {
        setSettingsLoading(false);
      }
    } else {
      const t = setTimeout(() => setPageReady(true), 500);
      return () => clearTimeout(t);
    }
  }, [user]);

  if (!pageReady || !user || settingsLoading) {
    return <Preloader message="Loading settings…" fullScreen />;
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSaving(true);
    try {
      await api.auth.updateProfile({
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        password: password || undefined,
        password_confirmation: password ? passwordConfirmation : undefined,
      });
      await refreshUser();
      setPassword('');
      setPasswordConfirmation('');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleDownloadBackup = async () => {
    setBackupError(null);
    setBackupLoading(true);
    try {
      const data = await api.backup.get();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stagepass-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Backup failed. Admin/Director only.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSettings) return;
    setSettingsError(null);
    setSettingsSuccess(false);
    setSettingsSaving(true);
    try {
      // Send full payload: merge DEFAULTS with current state so every key is always sent (no undefined)
      const payload: Record<string, string | number | boolean | null> = {};
      for (const key of Object.keys(DEFAULTS)) {
        const v = appSettings[key];
        payload[key] = v === undefined ? (DEFAULTS[key] ?? null) : v;
      }
      const updated = await api.settings.update(payload);
      setAppSettings((prev) => ({ ...DEFAULTS, ...prev, ...updated }));
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 4000);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const updateSetting = (key: string, value: string | number | boolean) => {
    setAppSettings((prev) => ({ ...prev, [key]: value }));
  };

  const officeLat = parseCoord(appSettings.office_latitude);
  const officeLon = parseCoord(appSettings.office_longitude);
  const officeRadius = getNum(appSettings.office_radius_m) || 100;
  const hasOfficeCoords = officeLat != null && officeLon != null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        subtitle="Profile, office location, application options, and backup."
      />

      {/* Profile */}
      <SectionCard sectionLabel="Profile">
        <div className="px-6 py-5">
          {profileError && (
            <div className="form-error-banner mb-5">{profileError}</div>
          )}
          <form onSubmit={handleSaveProfile} className="space-y-5 max-w-xl">
            <div className="form-field">
              <label className="form-label" htmlFor="settings-name">Name</label>
              <input
                id="settings-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                placeholder="Your name"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="settings-email">Email</label>
              <input
                id="settings-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="you@example.com"
              />
            </div>
            <div className="form-field">
              <label className="form-label form-label-optional" htmlFor="settings-password">
                New password (leave blank to keep current)
              </label>
              <input
                id="settings-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="Min 8 characters"
                autoComplete="new-password"
              />
            </div>
            {password && (
              <div className="form-field">
                <label className="form-label" htmlFor="settings-password-confirm">
                  Confirm new password
                </label>
                <input
                  id="settings-password-confirm"
                  type="password"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  className="form-input"
                  placeholder="Confirm password"
                  autoComplete="new-password"
                />
              </div>
            )}
            <div className="form-actions">
              <button
                type="submit"
                disabled={profileSaving}
                className="btn-brand disabled:opacity-50"
              >
                {profileSaving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>
        </div>
      </SectionCard>

      {/* Application & system options */}
      <SectionCard sectionLabel="Application & system options">
        <div className="px-6 py-5">
          {settingsLoading ? (
            <p className="text-slate-500">Loading settings…</p>
          ) : (
            <>
              {!canEditSettings && (
                <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
                  Only Admin and Director can view and edit system settings.
                </p>
              )}
              {settingsError && (
                <div className="form-error-banner mb-5">{settingsError}</div>
              )}
              {settingsSuccess && (
                <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  Settings saved to the database successfully.
                </div>
              )}
              <form onSubmit={handleSaveSettings} className="space-y-10">
                {/* Application – branding & support */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">
                    Application
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="form-field">
                      <label className="form-label" htmlFor="app_name">App name</label>
                      <input
                        id="app_name"
                        type="text"
                        value={getStr(appSettings.app_name)}
                        onChange={(e) => updateSetting('app_name', e.target.value)}
                        className="form-input"
                        disabled={!canEditSettings}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label" htmlFor="company_name">Company name</label>
                      <input
                        id="company_name"
                        type="text"
                        value={getStr(appSettings.company_name)}
                        onChange={(e) => updateSetting('company_name', e.target.value)}
                        className="form-input"
                        disabled={!canEditSettings}
                      />
                    </div>
                    <div className="form-field sm:col-span-2">
                      <label className="form-label form-label-optional" htmlFor="app_support_email">
                        Support email
                      </label>
                      <input
                        id="app_support_email"
                        type="email"
                        value={getStr(appSettings.app_support_email)}
                        onChange={(e) => updateSetting('app_support_email', e.target.value)}
                        className="form-input"
                        placeholder="support@example.com"
                        disabled={!canEditSettings}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label form-label-optional" htmlFor="support_phone">
                        Support phone number
                      </label>
                      <input
                        id="support_phone"
                        type="tel"
                        value={getStr(appSettings.support_phone)}
                        onChange={(e) => updateSetting('support_phone', e.target.value)}
                        className="form-input"
                        placeholder="+254 700 000 000"
                        disabled={!canEditSettings}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label form-label-optional" htmlFor="support_whatsapp_phone">
                        WhatsApp support number
                      </label>
                      <input
                        id="support_whatsapp_phone"
                        type="tel"
                        value={getStr(appSettings.support_whatsapp_phone)}
                        onChange={(e) => updateSetting('support_whatsapp_phone', e.target.value)}
                        className="form-input"
                        placeholder="+254 700 000 000"
                        disabled={!canEditSettings}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label" htmlFor="timezone">Timezone</label>
                      <select
                        id="timezone"
                        value={getStr(appSettings.timezone)}
                        onChange={(e) => updateSetting('timezone', e.target.value)}
                        className="form-select"
                        disabled={!canEditSettings}
                      >
                        {TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>{tz}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="form-label" htmlFor="payment_currency">Payment currency</label>
                      <input
                        id="payment_currency"
                        type="text"
                        value={getStr(appSettings.payment_currency)}
                        onChange={(e) => updateSetting('payment_currency', e.target.value.toUpperCase().slice(0, 6))}
                        className="form-input"
                        placeholder="KES"
                        disabled={!canEditSettings}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label" htmlFor="date_format">Date format</label>
                      <select
                        id="date_format"
                        value={getStr(appSettings.date_format)}
                        onChange={(e) => updateSetting('date_format', e.target.value)}
                        className="form-select"
                        disabled={!canEditSettings}
                      >
                        {DATE_FORMATS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="form-label" htmlFor="time_format">Time format</label>
                      <select
                        id="time_format"
                        value={getStr(appSettings.time_format)}
                        onChange={(e) => updateSetting('time_format', e.target.value)}
                        className="form-select"
                        disabled={!canEditSettings}
                      >
                        {TIME_FORMATS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="form-label" htmlFor="items_per_page">List items per page</label>
                      <input
                        id="items_per_page"
                        type="number"
                        min={5}
                        max={100}
                        value={getNum(appSettings.items_per_page)}
                        onChange={(e) => updateSetting('items_per_page', parseInt(e.target.value, 10) || 20)}
                        className="form-input"
                        disabled={!canEditSettings}
                      />
                    </div>
                  </div>
                </div>

                {/* Office location – Places search (same as Events), map when coords set, then form */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5">
                  <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-600">
                    Office location
                  </h3>
                  <p className="mb-4 text-sm text-slate-600">
                    Search for your office address to set the geofence centre. Permanent crew can &quot;Check in office&quot; from the app when within the radius.
                  </p>
                  <div className="mb-4">
                    <label className="form-label form-label-optional" htmlFor="office-location-search">
                      Search address or venue
                    </label>
                    <LocationSearchInput
                      id="office-location-search"
                      value={getStr(appSettings.office_location_name)}
                      onChange={(value) => updateSetting('office_location_name', value)}
                      onSelect={({ location_name, latitude, longitude }) => {
                        updateSetting('office_location_name', location_name);
                        updateSetting('office_latitude', String(latitude));
                        updateSetting('office_longitude', String(longitude));
                      }}
                      placeholder="Search for office address (Google Places)"
                      disabled={!canEditSettings}
                    />
                    {hasOfficeCoords && (
                      <p className="mt-1 text-xs text-slate-500">
                        Coordinates: {Number(officeLat).toFixed(5)}, {Number(officeLon).toFixed(5)}
                      </p>
                    )}
                  </div>
                  {hasOfficeCoords && (
                    <div className="mb-5">
                      <OfficeMap
                        latitude={officeLat}
                        longitude={officeLon}
                        radiusM={officeRadius}
                      />
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="form-field">
                      <label className="form-label form-label-optional" htmlFor="office_latitude">
                        Latitude
                      </label>
                      <input
                        id="office_latitude"
                        type="text"
                        inputMode="decimal"
                        value={getStr(appSettings.office_latitude)}
                        onChange={(e) => updateSetting('office_latitude', e.target.value.trim())}
                        className="form-input"
                        placeholder="e.g. -1.292066"
                        disabled={!canEditSettings}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label form-label-optional" htmlFor="office_longitude">
                        Longitude
                      </label>
                      <input
                        id="office_longitude"
                        type="text"
                        inputMode="decimal"
                        value={getStr(appSettings.office_longitude)}
                        onChange={(e) => updateSetting('office_longitude', e.target.value.trim())}
                        className="form-input"
                        placeholder="e.g. 36.821946"
                        disabled={!canEditSettings}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label" htmlFor="office_radius_m">
                        Geofence radius (m)
                      </label>
                      <input
                        id="office_radius_m"
                        type="number"
                        min={10}
                        max={500}
                        value={getNum(appSettings.office_radius_m) || 100}
                        onChange={(e) => updateSetting('office_radius_m', parseInt(e.target.value, 10) || 100)}
                        className="form-input"
                        disabled={!canEditSettings}
                      />
                      <p className="mt-1 text-xs text-slate-500">Crew must be within this distance to check in (default 100 m).</p>
                    </div>
                    <div className="form-field sm:col-span-2">
                      <label className="form-label form-label-optional" htmlFor="office_checkin_start_time">
                        Check-in window
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          id="office_checkin_start_time"
                          type="time"
                          value={getStr(appSettings.office_checkin_start_time).slice(0, 5)}
                          onChange={(e) => updateSetting('office_checkin_start_time', e.target.value)}
                          className="form-input max-w-[8rem]"
                          disabled={!canEditSettings}
                        />
                        <span className="text-slate-500">to</span>
                        <input
                          id="office_checkin_end_time"
                          type="time"
                          value={getStr(appSettings.office_checkin_end_time).slice(0, 5)}
                          onChange={(e) => updateSetting('office_checkin_end_time', e.target.value)}
                          className="form-input max-w-[8rem]"
                          disabled={!canEditSettings}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Permanent crew can office check-in only in this time window.</p>
                    </div>
                  </div>
                </div>

                {/* Events & check-in */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">
                    Events & check-in
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="form-field">
                      <label className="form-label" htmlFor="default_geofence_radius_m">
                        Default geofence radius (m) for events
                      </label>
                      <input
                        id="default_geofence_radius_m"
                        type="number"
                        min={50}
                        max={2000}
                        value={getNum(appSettings.default_geofence_radius_m)}
                        onChange={(e) => updateSetting('default_geofence_radius_m', parseInt(e.target.value, 10) || 100)}
                        className="form-input"
                        disabled={!canEditSettings}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label" htmlFor="checkin_allowed_minutes_before">
                        Check-in allowed (minutes before start)
                      </label>
                      <input
                        id="checkin_allowed_minutes_before"
                        type="number"
                        min={0}
                        max={480}
                        value={getNum(appSettings.checkin_allowed_minutes_before)}
                        onChange={(e) => updateSetting('checkin_allowed_minutes_before', parseInt(e.target.value, 10) || 0)}
                        className="form-input"
                        disabled={!canEditSettings}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label" htmlFor="default_event_start_time">
                        Default event start time
                      </label>
                      <input
                        id="default_event_start_time"
                        type="time"
                        value={getStr(appSettings.default_event_start_time).slice(0, 5)}
                        onChange={(e) => updateSetting('default_event_start_time', e.target.value)}
                        className="form-input"
                        disabled={!canEditSettings}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label" htmlFor="default_event_end_time">
                        Default event end time
                      </label>
                      <input
                        id="default_event_end_time"
                        type="time"
                        value={getStr(appSettings.default_event_end_time).slice(0, 5)}
                        onChange={(e) => updateSetting('default_event_end_time', e.target.value)}
                        className="form-input"
                        disabled={!canEditSettings}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label" htmlFor="default_event_status">
                        Default event status (new events)
                      </label>
                      <select
                        id="default_event_status"
                        value={getStr(appSettings.default_event_status)}
                        onChange={(e) => updateSetting('default_event_status', e.target.value)}
                        className="form-select"
                        disabled={!canEditSettings}
                      >
                        {EVENT_STATUSES.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field flex items-center gap-2 sm:col-span-2">
                      <input
                        id="require_geofence_for_checkin"
                        type="checkbox"
                        checked={getBool(appSettings.require_geofence_for_checkin)}
                        onChange={(e) => updateSetting('require_geofence_for_checkin', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent"
                        disabled={!canEditSettings}
                      />
                      <label htmlFor="require_geofence_for_checkin" className="text-sm text-slate-700">
                        Require geofence for check-in (crew must be within radius)
                      </label>
                    </div>
                    <div className="form-field flex items-center gap-2 sm:col-span-2">
                      <input
                        id="allow_crew_self_checkin"
                        type="checkbox"
                        checked={getBool(appSettings.allow_crew_self_checkin)}
                        onChange={(e) => updateSetting('allow_crew_self_checkin', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent"
                        disabled={!canEditSettings}
                      />
                      <label htmlFor="allow_crew_self_checkin" className="text-sm text-slate-700">
                        Allow crew to self check-in from the app
                      </label>
                    </div>
                  </div>
                </div>

                {/* Notifications */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">
                    Notifications
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="form-field flex items-center gap-2">
                      <input
                        id="notifications_email_enabled"
                        type="checkbox"
                        checked={getBool(appSettings.notifications_email_enabled)}
                        onChange={(e) => updateSetting('notifications_email_enabled', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent"
                        disabled={!canEditSettings}
                      />
                      <label htmlFor="notifications_email_enabled" className="text-sm text-slate-700">
                        Enable email reminders (event near, check-in due)
                      </label>
                    </div>
                    <div className="form-field flex items-center gap-2">
                      <input
                        id="notifications_sms_enabled"
                        type="checkbox"
                        checked={getBool(appSettings.notifications_sms_enabled)}
                        onChange={(e) => updateSetting('notifications_sms_enabled', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent"
                        disabled={!canEditSettings}
                      />
                      <label htmlFor="notifications_sms_enabled" className="text-sm text-slate-700">
                        Enable SMS reminders
                      </label>
                    </div>
                    <div className="form-field">
                      <label className="form-label" htmlFor="reminder_lead_hours">
                        Reminder lead time (hours before event)
                      </label>
                      <input
                        id="reminder_lead_hours"
                        type="number"
                        min={1}
                        max={168}
                        value={getNum(appSettings.reminder_lead_hours)}
                        onChange={(e) => updateSetting('reminder_lead_hours', parseInt(e.target.value, 10) || 24)}
                        className="form-input"
                        disabled={!canEditSettings}
                      />
                    </div>
                  </div>
                </div>

                {/* Defaults & features */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">
                    Defaults & features
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="form-field">
                      <label className="form-label" htmlFor="default_equipment_condition">
                        Default equipment condition (new items)
                      </label>
                      <select
                        id="default_equipment_condition"
                        value={getStr(appSettings.default_equipment_condition)}
                        onChange={(e) => updateSetting('default_equipment_condition', e.target.value)}
                        className="form-select"
                        disabled={!canEditSettings}
                      >
                        {EQUIPMENT_CONDITIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field flex items-center gap-2 sm:col-span-2">
                      <input
                        id="allow_time_off_requests"
                        type="checkbox"
                        checked={getBool(appSettings.allow_time_off_requests)}
                        onChange={(e) => updateSetting('allow_time_off_requests', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent"
                        disabled={!canEditSettings}
                      />
                      <label htmlFor="allow_time_off_requests" className="text-sm text-slate-700">
                        Allow crew to submit time-off requests from the app
                      </label>
                    </div>
                    <div className="form-field flex items-center gap-2 sm:col-span-2">
                      <input
                        id="allow_biometric_mobile_login"
                        type="checkbox"
                        checked={getBool(appSettings.allow_biometric_mobile_login)}
                        onChange={(e) => updateSetting('allow_biometric_mobile_login', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent"
                        disabled={!canEditSettings}
                      />
                      <label htmlFor="allow_biometric_mobile_login" className="text-sm text-slate-700">
                        Allow biometric login on the mobile app (Face ID / fingerprint)
                      </label>
                    </div>
                    <p className="text-xs text-slate-500 sm:col-span-2 -mt-2">
                      When off, the app hides biometric sign-in; users still sign in with username and PIN. Enrollment stays on each device.
                    </p>
                  </div>
                </div>

                {canEditSettings && (
                  <div className="border-t border-slate-200 pt-6">
                    <button
                      type="submit"
                      disabled={settingsSaving}
                      className="btn-brand min-w-[12rem] disabled:opacity-50"
                    >
                      {settingsSaving ? 'Saving…' : 'Save application settings'}
                    </button>
                  </div>
                )}
              </form>
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard sectionLabel="Backup">
        <div className="px-6 py-5">
          {backupError && (
            <div className="form-error-banner mb-5">{backupError}</div>
          )}
          <p className="mb-4 text-sm text-slate-600">
            Download a JSON backup of users, events, and equipment. Available to Admin and Director roles only.
          </p>
          <button
            type="button"
            onClick={handleDownloadBackup}
            disabled={backupLoading}
            className="btn-brand disabled:opacity-50"
          >
            {backupLoading ? 'Preparing…' : 'Download backup'}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
