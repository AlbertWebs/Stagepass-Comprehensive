import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';
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
  const [canEditSettings, setCanEditSettings] = useState(false);

  useEffect(() => {
    if (user) {
      setPageReady(true);
      setName(user.name ?? '');
      setEmail(user.email ?? '');
      const isAdmin = user.roles?.some((r) => r.name === 'super_admin' || r.name === 'director');
      setCanEditSettings(!!isAdmin);
      if (isAdmin) {
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
    setSettingsSaving(true);
    try {
      const updated = await api.settings.update(appSettings);
      setAppSettings((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const updateSetting = (key: string, value: string | number | boolean) => {
    setAppSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Profile, application and system options, and backup."
      />

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

      <SectionCard sectionLabel="Application & system options">
        <div className="px-6 py-5">
          {settingsLoading ? (
            <p className="text-slate-500">Loading settings…</p>
          ) : (
            <>
              {!canEditSettings && (
                <p className="mb-4 text-sm text-amber-700">
                  Only Admin and Director can view and edit system settings.
                </p>
              )}
              {settingsError && (
                <div className="form-error-banner mb-5">{settingsError}</div>
              )}
              <form onSubmit={handleSaveSettings} className="space-y-8 max-w-3xl">
                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
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

                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
                    Events & check-in
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="form-field">
                      <label className="form-label" htmlFor="default_geofence_radius_m">
                        Default geofence radius (m)
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

                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
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

                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
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
                  </div>
                </div>

                {canEditSettings && (
                  <div className="form-actions border-t border-slate-200 pt-5">
                    <button
                      type="submit"
                      disabled={settingsSaving}
                      className="btn-brand disabled:opacity-50"
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
          <p className="text-sm text-slate-600 mb-4">
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
