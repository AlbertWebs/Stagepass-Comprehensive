/**
 * StagePass API client – REST API consumed by the mobile app.
 * Uses Laravel Sanctum token for auth.
 *
 * Architecture: API codebase is at C:\projects\Stapepass-mobile-app-api.
 * Set EXPO_PUBLIC_API_URL in .env to the base URL where the API is served (no trailing slash):
 * - Production: https://api.yourdomain.com
 * - Local:      http://0.0.0.0:8000
 * - Android emulator: http://10.0.2.2:8000
 * - Physical device:  http://<your-pc-ip>:8000
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const HOMEPAGE_SECTION_KEYS = [
  'upcoming_events',
  'my_events',
  'attendance_stats',
  'recent_activities',
  'assigned_tasks',
  'announcements',
] as const;
export type HomepageSectionKey = (typeof HOMEPAGE_SECTION_KEYS)[number];
export type HomepageLayoutMode = 'compact' | 'comfortable';
export type HomepagePreferences = {
  visibility: Record<HomepageSectionKey, boolean>;
  order: HomepageSectionKey[];
  layout: HomepageLayoutMode;
};
export const DEFAULT_HOMEPAGE_PREFERENCES: HomepagePreferences = {
  visibility: {
    upcoming_events: true,
    my_events: true,
    attendance_stats: true,
    recent_activities: true,
    assigned_tasks: true,
    announcements: true,
  },
  order: [...HOMEPAGE_SECTION_KEYS],
  layout: 'comfortable',
};

function getEASBuildProfile(): string {
  const extra = Constants.expoConfig?.extra as { easBuildProfile?: string } | undefined;
  return (extra?.easBuildProfile ?? '').trim();
}

function getDefaultApiBase(): string {
  const fromEnv =
    typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_URL
      ? process.env.EXPO_PUBLIC_API_URL.trim()
      : '';
  if (fromEnv && !fromEnv.includes('winenot')) {
    const base = fromEnv.replace(/\/+$/, '');
    if (!__DEV__) {
      const profile = getEASBuildProfile();
      if (profile === 'production' && /^http:\/\//i.test(base)) {
        throw new Error(
          'EXPO_PUBLIC_API_URL must use https:// for production store builds (Android usesCleartextTraffic is false). Set EXPO_PUBLIC_API_URL in EAS Environment variables (production), e.g. https://api.yourdomain.com'
        );
      }
    }
    return base;
  }
  if (!__DEV__) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is required for release builds. Set it in EAS Environment variables for this profile (e.g. https://api.yourdomain.com), or in .env for local release builds.'
    );
  }
  // Dev defaults (cleartext OK). Android emulator: set EXPO_PUBLIC_API_URL=http://10.0.2.2:8000 in .env if needed.
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
}

const API_BASE = getDefaultApiBase();

export const getApiBase = () => API_BASE;

/**
 * Build a device-loadable avatar URL. Fixes relative `/storage/...` paths and
 * legacy rows where the server stored APP_URL (e.g. localhost) while the app
 * calls a public API host.
 */
export function resolveUserAvatarUrl(avatarUrl: string | undefined | null): string | undefined {
  const raw = avatarUrl?.trim();
  if (!raw) return undefined;
  const base = getApiBase().replace(/\/+$/, '');
  const apiIsLocal = (): boolean => {
    try {
      const h = new URL(base.includes('://') ? base : `http://${base}`).hostname;
      return /^(localhost|127\.0\.0\.1|10\.0\.2\.2)$/i.test(h);
    } catch {
      return false;
    }
  };
  try {
    if (raw.startsWith('/')) {
      return `${base}${raw}`;
    }
    const parsed = new URL(raw);
    const badHost = /^(localhost|127\.0\.0\.1|10\.0\.2\.2)$/i.test(parsed.hostname);
    if (badHost && !apiIsLocal()) {
      const origin = new URL(base.includes('://') ? base : `http://${base}`).origin;
      return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    /* keep raw */
  }
  return raw;
}

export type ApiConfig = {
  token: string | null;
};

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
let unauthorizedSuppressedUntil = 0;

function clearGetCache() {
  getResponseCache.clear();
  inFlightGetRequests.clear();
}

export function setAuthToken(token: string | null) {
  authToken = token;
  if (!token) {
    clearGetCache();
  }
}
/** Call when 401 is received – app can clear token, Redux, and redirect to login */
export function setOnUnauthorized(callback: (() => void) | null) {
  onUnauthorized = callback;
}

export function getAuthToken() {
  return authToken;
}

/** Temporarily suppress global logout triggered by 401 (helps during biometric flows). */
export function suppressUnauthorizedForMs(ms: number) {
  unauthorizedSuppressedUntil = Date.now() + ms;
}

const LOG =
  typeof process !== 'undefined'
    ? process.env.EXPO_PUBLIC_API_LOGS === '1'
    : false;
const REQUEST_TIMEOUT_MS = 15000;
const GET_CACHE_TTL_MS = 15000;
const GET_CACHE_MAX_ENTRIES = 120;

type CachedGetEntry = {
  expiresAt: number;
  data: unknown;
};
const getResponseCache = new Map<string, CachedGetEntry>();
const inFlightGetRequests = new Map<string, Promise<unknown>>();

function isSafeGetCacheable(path: string): boolean {
  if (path.includes('/settings/public-app')) return false;
  // Admin may update office coordinates; avoid caching so home always sees current geofence.
  if (path.includes('/settings/office-checkin-config')) return false;
  // Per-user assignment; cache key is URL-only so X-Local-Date would be ignored → stale "no event".
  if (path.includes('/my-event-today')) return false;
  return !/\/(backup|payments|attendance\/checkin|attendance\/checkout)/.test(path);
}

/**
 * Include auth in the key so GET /me and other authenticated reads are not shared across
 * sessions/tokens (otherwise biometric login could hit a stale 401 or wrong in-flight request).
 */
function makeCacheKey(method: string, urlStr: string, bearerToken: string | null): string {
  const fp = bearerToken ? `t${bearerToken.length}:${bearerToken.slice(-24)}` : 'noauth';
  return `${method.toUpperCase()}::${urlStr}::${fp}`;
}

function pruneGetCache() {
  const now = Date.now();
  for (const [k, v] of getResponseCache.entries()) {
    if (v.expiresAt <= now) getResponseCache.delete(k);
  }
  if (getResponseCache.size <= GET_CACHE_MAX_ENTRIES) return;
  const keys = Array.from(getResponseCache.keys());
  const overflow = getResponseCache.size - GET_CACHE_MAX_ENTRIES;
  for (let i = 0; i < overflow; i += 1) getResponseCache.delete(keys[i]);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function getLocalDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getLocalDateTimeWithOffset(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  const s = pad2(date.getSeconds());
  const tzMin = -date.getTimezoneOffset();
  const sign = tzMin >= 0 ? '+' : '-';
  const abs = Math.abs(tzMin);
  const tzH = pad2(Math.floor(abs / 60));
  const tzM = pad2(abs % 60);
  return `${y}-${m}-${d}T${h}:${min}:${s}${sign}${tzH}:${tzM}`;
}

async function request<T>(
  path: string,
  options: RequestInit & { params?: Record<string, string> } = {}
): Promise<T> {
  const { params, ...init } = options;
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}/api${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (authToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
  }
  const h = headers as Record<string, string>;
  /** Ensures server audit logs classify requests as mobile (StagePass app). */
  if (!h['X-App-Source']) h['X-App-Source'] = 'mobile';
  if (!h['X-Local-Date']) h['X-Local-Date'] = getLocalDateString();
  if (!h['X-Local-DateTime']) h['X-Local-DateTime'] = getLocalDateTimeWithOffset();
  if (!h['X-Local-Timezone']) {
    try {
      h['X-Local-Timezone'] = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
    } catch {
      h['X-Local-Timezone'] = 'UTC';
    }
  }
  const urlStr = url.toString();
  const method = (init.method ?? 'GET').toUpperCase();
  const bearerForCache =
    authToken ??
    (() => {
      const raw = h['Authorization']?.replace(/^Bearer\s+/i, '').trim();
      return raw || null;
    })();
  const cacheKey = makeCacheKey(method, urlStr, bearerForCache);
  const cacheableGet = method === 'GET' && isSafeGetCacheable(path);
  const forceRefresh = (params as Record<string, string> | undefined)?.refresh === '1';
  if (cacheableGet && !forceRefresh) {
    pruneGetCache();
    const cached = getResponseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
    const inFlight = inFlightGetRequests.get(cacheKey);
    if (inFlight) return inFlight as Promise<T>;
  }
  if (LOG) {
    console.warn('[Stagepass API]', method, urlStr.replace(/token=[^&]+/g, 'token=***'));
  }
  const run = async (): Promise<T> => {
    let attempts = 0;
    while (attempts < 2) {
      attempts += 1;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(urlStr, { ...init, headers, signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json().catch(() => ({}));
        if (LOG) {
          console.warn('[Stagepass API]', res.status, path, res.ok ? 'OK' : 'FAIL', data?.message ?? '');
        }
      if (!res.ok) {
        if (res.status === 401) {
          // Some flows (e.g. biometric login checking /me) want to handle 401 locally
          // without triggering the global logout handler.
          const suppressGlobal =
            h['X-Suppress-Unauthorized'] === '1' || Date.now() < unauthorizedSuppressedUntil;
          // Helpful breadcrumb during debugging (shown when EXPO_PUBLIC_API_LOGS=1).
          if (LOG) {
            console.warn('[Stagepass API] 401 ->', method.toUpperCase(), path);
          }
          if (!suppressGlobal) {
            setAuthToken(null);
            onUnauthorized?.();
          }
        }
        throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
      }
        if (cacheableGet) {
          getResponseCache.set(cacheKey, {
            expiresAt: Date.now() + GET_CACHE_TTL_MS,
            data,
          });
        } else if (method !== 'GET') {
          // Any successful mutation may impact cached GET responses (e.g. /me).
          // Clear cache so relogin/profile screens always reflect latest server data.
          clearGetCache();
        }
        return data as T;
      } catch (e) {
        clearTimeout(timeout);
        const isAbort = e instanceof Error && e.name === 'AbortError';
        const isLikelyNetwork = isAbort || /network|timed out|failed to fetch/i.test(String(e));
        if (attempts < 2 && method === 'GET' && isLikelyNetwork) {
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }
        if (LOG) {
          console.warn('[Stagepass API] ERROR', path, e);
        }
        throw e;
      }
    }
    throw new Error('Request failed');
  };

  if (cacheableGet) {
    const p = run().finally(() => inFlightGetRequests.delete(cacheKey));
    inFlightGetRequests.set(cacheKey, p as Promise<unknown>);
    return p;
  }
  return run();
}

/** Multipart upload (e.g. profile photo). Do not set Content-Type so fetch sets boundary. */
async function requestMultipart<T>(
  path: string,
  formData: FormData
): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}/api${path}`);
  const headers: HeadersInit = {
    Accept: 'application/json',
  };
  if (authToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
  }
  const h = headers as Record<string, string>;
  if (!h['X-App-Source']) h['X-App-Source'] = 'mobile';
  if (!h['X-Local-Date']) h['X-Local-Date'] = getLocalDateString();
  if (!h['X-Local-DateTime']) h['X-Local-DateTime'] = getLocalDateTimeWithOffset();
  if (!h['X-Local-Timezone']) {
    try {
      h['X-Local-Timezone'] = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
    } catch {
      h['X-Local-Timezone'] = 'UTC';
    }
  }
  const urlStr = url.toString();
  if (LOG) {
    console.warn('[Stagepass API]', 'POST', urlStr, '(multipart)');
  }
  try {
    const res = await fetch(urlStr, { method: 'POST', body: formData, headers });
    const data = await res.json().catch(() => ({}));
    if (LOG) {
      console.warn('[Stagepass API]', res.status, path, res.ok ? 'OK' : 'FAIL', data?.message ?? '');
    }
    if (!res.ok) {
      if (res.status === 401) {
        if (LOG) {
          console.warn('[Stagepass API] 401 (multipart) ->', path);
        }
        const suppressGlobal = Date.now() < unauthorizedSuppressedUntil;
        if (!suppressGlobal) {
          setAuthToken(null);
          onUnauthorized?.();
        }
      }
      throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
    }
    return data as T;
  } catch (e) {
    if (LOG) {
      console.warn('[Stagepass API] ERROR', path, e);
    }
    throw e;
  }
}

export const api = {
  auth: {
    /** Mobile login with username and PIN */
    login: (username: string, pin: string, fcmToken?: string) =>
      request<{ token: string; user: User }>('/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), pin, fcm_token: fcmToken }),
      }),
    /** Fetch display name for login screen (by username or staff_id). Returns null if not found. */
    getLoginDisplayName: async (username: string): Promise<string | null> => {
      const trimmed = username.trim();
      if (!trimmed) return null;
      try {
        const data = await request<{ name: string }>('/login-display-name', { params: { username: trimmed } });
        return data?.name ?? null;
      } catch {
        return null;
      }
    },
    forgotPassword: (email: string) =>
      request<{ message: string }>('/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    logout: () => request<{ message: string }>('/logout', { method: 'POST' }),
    me: () => request<User>('/me'),
    /** Like me(), but does not trigger global logout on 401 (caller handles). */
    meLocal401: () => request<User>('/me', { headers: { 'X-Suppress-Unauthorized': '1' } }),
    /** Update current user profile (name, email, phone, address, optional password, optional PIN) */
    updateProfile: (body: {
      name?: string;
      email?: string;
      phone?: string;
      phone_number?: string;
      address?: string;
      emergencyContact?: string;
      emergency_contact?: string;
      password?: string;
      password_confirmation?: string;
      current_pin?: string;
      new_pin?: string;
      new_pin_confirmation?: string;
      fcm_token?: string | null;
      homepage_preferences?: HomepagePreferences;
    }) => request<User>('/me', { method: 'PATCH', body: JSON.stringify(body) }),
    /** Like updateProfile(), but suppress global logout on 401. */
    updateProfileLocal401: (body: {
      name?: string;
      email?: string;
      phone?: string;
      phone_number?: string;
      address?: string;
      emergencyContact?: string;
      emergency_contact?: string;
      password?: string;
      password_confirmation?: string;
      current_pin?: string;
      new_pin?: string;
      new_pin_confirmation?: string;
      fcm_token?: string | null;
      homepage_preferences?: HomepagePreferences;
    }) =>
      request<User>('/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'X-Suppress-Unauthorized': '1' },
      }),
    /** Upload passport/profile photo. Backend: POST /me/photo with multipart file "photo". Returns updated user. */
    uploadProfilePhoto: (imageUri: string) => {
      const formData = new FormData();
      formData.append('photo', {
        uri: imageUri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      } as unknown as Blob);
      return requestMultipart<{ user: User } | User>('/me/photo', formData);
    },
  },
  events: {
    /** List events. Backend returns only assigned for crew; admins get all. Supports Laravel pagination. */
    list: (params?: {
      status?: string;
      page?: number;
      per_page?: number;
      refresh?: boolean;
      activities_view?: boolean;
      on_date?: string;
      exclude_spanning_date?: string;
    }) => {
      const q: Record<string, string> = {};
      if (params?.status) q.status = params.status;
      if (params?.page != null) q.page = String(params.page);
      if (params?.per_page != null) q.per_page = String(params.per_page);
      if (params?.refresh) q.refresh = '1';
      if (params?.activities_view) q.activities_view = '1';
      if (params?.on_date) q.on_date = params.on_date;
      if (params?.exclude_spanning_date) q.exclude_spanning_date = params.exclude_spanning_date;
      return request<Paginated<Event>>('/events', Object.keys(q).length ? { params: q } : undefined);
    },
    get: (id: number) => request<Event>(`/events/${id}`),
    /** Event assigned to current user for today (crew/leader home). Pass localDate (YYYY-MM-DD) so backend uses device date. */
    myEventToday: (localDate?: string) =>
      request<{ event: Event | null }>('/my-event-today', {
        headers: localDate ? { 'X-Local-Date': localDate } : undefined,
      } as RequestInit),
    create: (body: Partial<Event>) =>
      request<Event>('/events', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Event>) =>
      request<Event>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    /** Admin: delete event */
    delete: (id: number) => request<unknown>(`/events/${id}`, { method: 'DELETE' }),
    /** Admin/team leader: assign user to event crew */
    assignUser: (eventId: number, userId: number, roleInEvent?: string) =>
      request<unknown>(`/events/${eventId}/assign-user`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, role_in_event: roleInEvent ?? null }),
      }),
    /** Admin/team leader: remove user from event crew */
    removeUser: (eventId: number, userId: number) =>
      request<unknown>(`/events/${eventId}/crew/${userId}`, { method: 'DELETE' }),
    /** Admin/team leader: transfer user from one event crew to another */
    transferUser: (eventId: number, userId: number, targetEventId: number) =>
      request<{ message: string; target_event_id: number }>(`/events/${eventId}/transfer-user`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, target_event_id: targetEventId }),
      }),
    /** Admin/team leader: end event with comment */
    end: (eventId: number, body: { end_comment: string }) =>
      request<Event>(`/events/${eventId}/end`, { method: 'POST', body: JSON.stringify(body) }),
    doneForDay: (eventId: number, closingComment: string) =>
      request<Event>(`/events/${eventId}/done-for-day`, {
        method: 'POST',
        body: JSON.stringify({ closing_comment: closingComment }),
      }),
    /** Admin/team leader: crew status for event */
    eventCrewStatus: (eventId: number) =>
      request<{ data: CrewStatusItem[] }>(`/events/${eventId}/crew-status`),
    pauseCrew: (eventId: number, userId: number, reason?: string) =>
      request<{ message: string }>(`/events/${eventId}/crew/${userId}/pause`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || undefined }),
      }),
    resumeCrew: (eventId: number, userId: number) =>
      request<{ message: string }>(`/events/${eventId}/crew/${userId}/resume`, { method: 'POST' }),
    recordCrewTransport: (eventId: number, userId: number, body: { transport_type: 'organization' | 'cab' | 'none'; transport_amount?: number | null }) =>
      request<{ message: string }>(`/events/${eventId}/crew/${userId}/transport`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    /** Admin/team leader: report issue */
    eventReportIssue: (eventId: number, body: { title: string; description?: string; severity?: string; photo_url?: string }) =>
      request<unknown>(`/events/${eventId}/report-issue`, { method: 'POST', body: JSON.stringify(body) }),
    /**
     * Admin/team leader: send message to crew.
     * Preferred endpoint: /events/{id}/message (if backend supports it).
     * Fallback: /communications (currently available in backend routes).
     */
    eventMessage: async (
      eventId: number,
      body: { target: 'all' | 'department' | 'user'; department?: string; user_id?: number; message: string }
    ) => {
      try {
        return await request<unknown>(`/events/${eventId}/message`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        const notFound = /not found|could not be found|404/i.test(msg);
        if (!notFound) throw err;

        // Fallback to communications API so mobile flow still works.
        const recipientScope =
          body.target === 'all' || body.target === 'user'
            ? 'event_crew'
            : body.target === 'department'
              ? 'crew'
              : 'all_staff';
        const subjectSuffix =
          body.target === 'all'
            ? 'All crew'
            : body.target === 'department'
              ? `Department: ${body.department ?? 'Crew'}`
              : `User #${body.user_id ?? 'Crew'}`;

        return request<unknown>('/communications', {
          method: 'POST',
          body: JSON.stringify({
            subject: `Event #${eventId}: ${subjectSuffix}`,
            body: body.message,
            recipient_scope: recipientScope,
            event_id: recipientScope === 'event_crew' ? eventId : undefined,
            send_as_message: true,
            send_as_email: false,
          }),
        });
      }
    },
  },
  /** Optional: two-step auth verify PIN (if backend supports POST /verify-pin) */
  authVerifyPin: (pin: string) =>
    request<{ token: string; user: User }>('/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),
  attendance: {
    /** Combined stats: events + office check-ins (last 30d). pull_up_percentage = combined pull-up rate. */
    stats: () =>
      request<{
        total_assigned: number;
        checked_in: number;
        missed: number;
        attendance_percentage: number;
        office_checkins_last_30: number;
        pull_up_percentage: number;
      }>('/attendance/stats'),
    checkin: (eventId: number, latitude: number, longitude: number) =>
      request<{ checkin_time: string; total_hours?: number; standard_hours?: number; extra_hours?: number; day_type?: 'normal' | 'sunday' | 'holiday'; is_sunday?: boolean; is_holiday?: boolean; holiday_name?: string | null }>('/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({
          event_id: eventId,
          latitude,
          longitude,
          timestamp: getLocalDateTimeWithOffset(),
        }),
      }),
    /** Admin/team leader: check in a crew member on their behalf (manual check-in) */
    checkinOnBehalf: (eventId: number, userId: number, _latitude?: number, _longitude?: number) =>
      request<{ checkin_time: string; total_hours?: number; standard_hours?: number; extra_hours?: number; day_type?: 'normal' | 'sunday' | 'holiday' }>(`/events/${eventId}/attendance/manual-checkin/${userId}`, {
        method: 'POST',
      }),
    checkout: (eventId: number) =>
      request<{ checkout_time: string; total_hours: number; standard_hours?: number; extra_hours?: number; day_type?: 'normal' | 'sunday' | 'holiday'; is_sunday?: boolean; is_holiday?: boolean; holiday_name?: string | null }>('/attendance/checkout', {
        method: 'POST',
        body: JSON.stringify({ event_id: eventId }),
      }),
    /** Daily office check-in at configured location (e.g. 100 m radius). Backend must implement POST /attendance/office-checkin. */
    officeCheckin: (latitude: number, longitude: number) =>
      request<{ checkin_time: string; total_hours?: number; standard_hours?: number; extra_hours?: number; day_type?: 'normal' | 'sunday' | 'holiday'; is_sunday?: boolean; is_holiday?: boolean; holiday_name?: string | null }>('/attendance/office-checkin', {
        method: 'POST',
        body: JSON.stringify({ latitude, longitude, timestamp: getLocalDateTimeWithOffset() }),
      }),
    /** Daily office check-out. Sends timestamp and optional location for audit. */
    officeCheckout: (latitude?: number, longitude?: number) =>
      request<{ checkout_time: string; total_hours?: number; standard_hours?: number; extra_hours?: number; day_type?: 'normal' | 'sunday' | 'holiday'; is_sunday?: boolean; is_holiday?: boolean; holiday_name?: string | null }>('/attendance/office-checkout', {
        method: 'POST',
        body: JSON.stringify({
          latitude,
          longitude,
          timestamp: getLocalDateTimeWithOffset(),
        }),
      }),
  },
  timeOff: {
    request: (startDate: string, endDate: string, reason?: string, notes?: string) =>
      request<TimeOffRequest>('/timeoff/request', {
        method: 'POST',
        body: JSON.stringify({ start_date: startDate, end_date: endDate, reason, notes: notes || undefined }),
      }),
    /** Upload files for a time off request (pending only). files: { uri, name?, mimeType? } from document picker. */
    uploadAttachments: async (requestId: number, files: { uri: string; name?: string; mimeType?: string }[]) => {
      const formData = new FormData();
      files.forEach((f, i) => {
        formData.append('attachments[]', {
          uri: f.uri,
          name: f.name ?? `file_${i}`,
          type: f.mimeType ?? 'application/octet-stream',
        } as unknown as Blob);
      });
      return requestMultipart<TimeOffRequest>(`/timeoff/request/${requestId}/attachments`, formData);
    },
  },
  payments: {
    /** Request payment for an event (crew: use own user id; team leader: can use crew member id). */
    request: (eventId: number, userId: number, hours: number, perDiem?: number, allowances?: number) =>
      request<{ id: number; event_id: number; user_id: number; hours: number; per_diem: number; allowances: number; total_amount: number; status: string }>(
        '/payments/initiate',
        {
          method: 'POST',
          body: JSON.stringify({
            event_id: eventId,
            user_id: userId,
            hours,
            per_diem: perDiem ?? 0,
            allowances: allowances ?? 0,
          }),
        }
      ),
    list: (params?: { status?: string; event_id?: number; per_page?: number; page?: number }) =>
      request<{ data: Payment[]; total?: number }>('/payments', {
        params: params
          ? (Object.fromEntries(
              Object.entries(params)
                .filter(([, v]) => v !== undefined && v !== '')
                .map(([k, v]) => [k, String(v)])
            ) as Record<string, string>)
          : undefined,
      }),
    approve: (paymentId: number) =>
      request<Payment>('/payments/approve', { method: 'POST', body: JSON.stringify({ payment_id: paymentId }) }),
    reject: (paymentId: number, reason?: string) =>
      request<Payment>('/payments/reject', {
        method: 'POST',
        body: JSON.stringify({ payment_id: paymentId, rejection_reason: reason }),
      }),
    earnedAllowances: (params?: { event_id?: number; crew_id?: number; status?: string; search?: string; page?: number; per_page?: number }) =>
      request<{
        data: EarnedAllowanceEventGroup[];
        flat?: EarnedAllowanceDetail[];
        pagination: { current_page: number; last_page: number; total: number; per_page: number };
      }>('/payments/earned-allowances', {
        params: params
          ? (Object.fromEntries(
              Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
            ) as Record<string, string>)
          : undefined,
      }),
    addEarnedAllowance: (body: { event_id: number; crew_id: number; allowance_type_id: number; amount: number; description?: string }) =>
      request<EarnedAllowanceDetail>('/payments/earned-allowances', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    submitAllowanceRequest: (body: {
      event_id: number;
      allowance_type_id: number;
      amount: number;
      reason: string;
      attachment: { uri: string; name?: string; mimeType?: string };
    }) => {
      const formData = new FormData();
      formData.append('event_id', String(body.event_id));
      formData.append('allowance_type_id', String(body.allowance_type_id));
      formData.append('amount', String(body.amount));
      formData.append('reason', body.reason);
      formData.append('attachment', {
        uri: body.attachment.uri,
        name: body.attachment.name ?? 'receipt.jpg',
        type: body.attachment.mimeType ?? 'image/jpeg',
      } as unknown as Blob);
      return requestMultipart<{ message: string; data: EarnedAllowanceDetail }>('/payments/allowance-requests', formData);
    },
    updateAllowanceStatus: (id: number, status: 'pending' | 'approved' | 'rejected' | 'paid', comment?: string) =>
      request<EarnedAllowanceDetail>(`/payments/earned-allowances/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, comment: comment ?? undefined }),
      }),
    allowanceTypes: () => request<{ data: AllowanceTypeItem[] }>('/payments/allowance-types'),
    createAllowanceType: (name: string) =>
      request<AllowanceTypeItem>('/payments/allowance-types', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
  },
  /** Crew: my tasks (GET /api/my-tasks) */
  myTasks: () => request<{ data: MyTask[] }>('/my-tasks'),
  taskComplete: (taskId: number, body?: { comment?: string; photo_url?: string }) =>
    request<MyTask>(`/task/${taskId}/complete`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  /** Admin: dashboard (optional backend endpoint; fallback: use events + users) */
  adminDashboard: () =>
    request<AdminDashboardData>('/admin/dashboard').catch(() => ({ today_events: 0, active_events: 0, total_crew: 0 })),
  roles: {
    list: () => request<{ data: { id: number; name: string }[] }>('/roles'),
  },
  users: {
    list: () => request<{ data: User[] }>('/users'),
    get: (id: number) => request<User>(`/users/${id}`),
    create: (body: Partial<User> & { password?: string }) =>
      request<User>('/users', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<User>) =>
      request<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<unknown>(`/users/${id}`, { method: 'DELETE' }),
    /** Admin: set/reset PIN for a user (no current PIN required). */
    setPin: (userId: number, newPin: string, newPinConfirmation: string) =>
      request<User>(`/users/${userId}/set-pin`, {
        method: 'POST',
        body: JSON.stringify({ new_pin: newPin, new_pin_confirmation: newPinConfirmation }),
      }),
  },
  clients: {
    list: () => request<{ data: Client[] }>('/clients'),
    get: (id: number) => request<Client>(`/clients/${id}`),
    create: (body: Partial<Client>) =>
      request<Client>('/clients', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Client>) =>
      request<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<unknown>(`/clients/${id}`, { method: 'DELETE' }),
  },
  equipment: {
    list: () => request<{ data: Equipment[] }>('/equipment'),
    get: (id: number) => request<Equipment>(`/equipment/${id}`),
    create: (body: Partial<Equipment>) =>
      request<Equipment>('/equipment', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Equipment>) =>
      request<Equipment>(`/equipment/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<unknown>(`/equipment/${id}`, { method: 'DELETE' }),
  },
  reports: {
    /** Legacy combined report (from/to required) */
    get: (params?: { from?: string; to?: string }) =>
      request<ReportsData>('/reports', { params: params as Record<string, string> | undefined }),
    /** Event report with filters */
    events: (params?: ReportFilters) =>
      request<ReportEventsResponse>('/reports/events', { params: reportParams(params) }),
    /** Crew attendance report */
    crewAttendance: (params?: ReportFilters) =>
      request<ReportCrewAttendanceResponse>('/reports/crew-attendance', { params: reportParams(params) }),
    /** Crew payment report */
    crewPayments: (params?: ReportFilters) =>
      request<ReportCrewPaymentsResponse>('/reports/crew-payments', { params: reportParams(params) }),
    /** Task report */
    tasks: (params?: ReportFilters) =>
      request<ReportTasksResponse>('/reports/tasks', { params: reportParams(params) }),
    /** Financial summary report */
    financial: (params?: ReportFilters) =>
      request<ReportFinancialResponse>('/reports/financial', { params: reportParams(params) }),
    /** End-of-day signed report */
    endOfDay: (params?: ReportFilters) =>
      request<ReportEndOfDayResponse>('/reports/end-of-day', { params: reportParams(params) }),
    /** Export as printable HTML (open in browser / share as PDF) */
    exportUrl: (type: ReportType, params?: ReportFilters): string => {
      const base = typeof getApiBase === 'function' ? getApiBase() : '';
      const q = new URLSearchParams(reportParams(params) || {});
      q.set('type', type);
      const token = getAuthToken();
      return `${base}/api/reports/export?${q.toString()}` + (token ? `&token=${encodeURIComponent(token)}` : '');
    },
    exportHtml: (type: ReportType, params?: ReportFilters) =>
      request<{ html: string; title: string }>('/reports/export', {
        params: { ...reportParams(params), type, format: 'json' } as Record<string, string>,
      }),
  },
  timeoff: {
    list: () => request<{ data: TimeOffRequest[] }>('/timeoff'),
    approve: (requestId: number) =>
      request<TimeOffRequest>('/timeoff/approve', {
        method: 'POST',
        body: JSON.stringify({ request_id: requestId }),
      }),
    reject: (requestId: number) =>
      request<TimeOffRequest>('/timeoff/reject', {
        method: 'POST',
        body: JSON.stringify({ request_id: requestId }),
      }),
  },
  communications: {
    list: () => request<{ data: Communication[] }>('/communications'),
    get: (id: number) => request<Communication>(`/communications/${id}`),
    create: (body: {
      title?: string;
      subject?: string;
      body?: string;
      target?: string;
      recipient_scope?: 'all_staff' | 'crew' | 'event_crew';
      event_id?: number;
      send_as_message?: boolean;
      send_as_email?: boolean;
    }) => {
      const mappedScope: 'all_staff' | 'crew' | 'event_crew' =
        body.recipient_scope
          ?? (body.target === 'all' || body.target === 'all_staff'
            ? 'all_staff'
            : body.target === 'crew'
              ? 'crew'
              : 'event_crew');
      const payload = {
        subject: body.subject ?? body.title ?? 'Message',
        body: body.body ?? '',
        recipient_scope: mappedScope,
        event_id: mappedScope === 'event_crew' ? body.event_id : undefined,
        send_as_message: body.send_as_message ?? true,
        send_as_email: body.send_as_email ?? false,
      };
      return request<Communication>('/communications', { method: 'POST', body: JSON.stringify(payload) });
    },
    delete: (id: number) => request<unknown>(`/communications/${id}`, { method: 'DELETE' }),
  },
  backup: {
    get: () =>
      request<{ exported_at: string; users: unknown[]; events: unknown[]; equipment: unknown[] }>('/backup'),
  },
  settings: {
    get: () => request<Record<string, unknown>>('/settings'),
    /** Unauthenticated — org policy for login screen (e.g. biometric allowed). */
    getPublicAppConfig: () =>
      request<{ allow_biometric_mobile_login: boolean }>('/settings/public-app'),
    /** Office check-in location + time window; available to all authenticated users (crew see admin-configured office). */
    getOfficeCheckinConfig: () =>
      request<{
        office_latitude: number | null;
        office_longitude: number | null;
        office_radius_m: number;
        office_checkin_start_time: string;
        office_checkin_end_time: string;
        /** Weekdays when check-in is required: 0=Sun … 6=Sat (same as Date.getDay()). */
        office_checkin_required_days?: number[];
      }>('/settings/office-checkin-config'),
    update: (settings: Record<string, unknown>) =>
      request<Record<string, unknown>>('/settings', { method: 'POST', body: JSON.stringify({ settings }) }),
  },
  auditLogs: {
    list: (params?: { page?: number }) =>
      request<{ data: AuditLogEntry[] }>('/audit-logs', { params: params as Record<string, string> | undefined }),
  },
  /** Task management: list (crew = assigned, admin = all), create/update/delete (admin), status + comments */
  tasks: {
    list: (params?: { event_id?: number; user_id?: number; status?: string; search?: string; per_page?: number; page?: number }) =>
      request<PaginatedResponse<TaskItem>>('/tasks', {
        params: params
          ? Object.fromEntries(
              Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
            ) as Record<string, string>
          : undefined,
      }),
    get: (id: number) => request<TaskItem>(`/tasks/${id}`),
    create: (body: {
      title: string;
      description?: string;
      event_id?: number;
      priority?: string;
      due_date?: string;
      notes?: string;
      assignee_ids?: number[];
    }) => request<TaskItem>('/tasks', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<CreateTaskBody>) =>
      request<TaskItem>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<unknown>(`/tasks/${id}`, { method: 'DELETE' }),
    updateStatus: (id: number, status: TaskStatus) =>
      request<TaskItem>(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    comments: (id: number) => request<{ data: TaskCommentItem[] }>(`/tasks/${id}/comments`),
    addComment: (id: number, body: string) =>
      request<TaskCommentItem>(`/tasks/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
  },
};

export interface MyTask {
  id: number;
  title: string;
  status: string;
  deadline?: string;
  notes?: string;
  event_id?: number;
}

/** Task management (new): full task with assignees, event, comments */
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface TaskItem {
  id: number;
  title: string;
  description?: string | null;
  event_id?: number | null;
  created_by?: number | null;
  priority: TaskPriority;
  due_date?: string | null;
  status: TaskStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  event?: { id: number; name: string; date?: string } | null;
  creator?: { id: number; name: string } | null;
  assignees?: { id: number; name: string }[];
  comments?: TaskCommentItem[];
}

export interface TaskCommentItem {
  id: number;
  task_id: number;
  user_id: number;
  body: string;
  created_at: string;
  user?: { id: number; name: string };
}

export interface CreateTaskBody {
  title: string;
  description?: string;
  event_id?: number;
  priority?: TaskPriority;
  due_date?: string;
  notes?: string;
  assignee_ids?: number[];
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface CrewStatusItem {
  user_id: number;
  name: string;
  department?: string;
  status: 'checked_in' | 'late' | 'pending' | 'checked_out';
  checkin_time?: string;
  is_paused?: boolean;
  pause_duration?: number;
  pause_reason?: string | null;
  transport_type?: 'organization' | 'cab' | 'none' | null;
  transport_amount?: number | null;
  total_hours?: number;
  extra_hours?: number;
}

export interface AdminDashboardData {
  today_events: number;
  active_events: number;
  total_crew: number;
  checkin_status?: Record<string, number>;
  reported_issues?: number;
}

export type RoleName = 'crew' | 'team_leader' | 'admin' | 'accountant' | 'logistics' | 'operations';

export interface User {
  id: number;
  name: string;
  email: string;
  username?: string;
  staff_id?: string;
  roles?: { id: number; name: string }[];
  /** Profile/passport photo URL (set by backend after upload) */
  avatar_url?: string;
  phone?: string;
  phone_number?: string;
  address?: string;
  emergencyContact?: string;
  emergency_contact?: string;
  /** Permanent employees must daily office check-in 9–10 AM */
  is_permanent_employee?: boolean;
  /** Set by backend when user has done office check-in today */
  office_checked_in_today?: boolean;
  office_checkin_time?: string;
  office_checked_out_today?: boolean;
  office_checkout_time?: string;
  office_total_hours?: number | null;
  /** Capped at 8h for a normal shift (same rules as backend). */
  office_standard_hours?: number | null;
  office_extra_hours?: number | null;
  /** Live office session: within_standard | in_extra_hours; after checkout: checked_out */
  office_hours_status?: 'within_standard' | 'in_extra_hours' | 'checked_out' | null;
  office_day_type?: 'normal' | 'sunday' | 'holiday' | null;
  office_is_sunday?: boolean;
  office_is_holiday?: boolean;
  office_holiday_name?: string | null;
  /** Set by backend when user has approved time off that includes today */
  has_approved_time_off_today?: boolean;
  homepage_preferences?: HomepagePreferences;
  /** From GET /me — mirrors system setting; when false, mobile hides biometric login. */
  allow_biometric_mobile_login?: boolean;
}

/** Resolve app role from backend role names. */
export function getRole(user: User | null): RoleName {
  if (!user?.roles?.length) return 'crew';
  const names = user.roles.map((r) => String(r.name || '').trim().toLowerCase());
  if (names.includes('super_admin') || names.includes('director')) return 'admin';
  const isTeamLeaderName = (n: string) =>
    n === 'team_leader' || n === 'teamleader' || n.replace(/\s+/g, '') === 'teamleader';
  if (names.some(isTeamLeaderName)) return 'team_leader';
  if (names.includes('accountant')) return 'accountant';
  if (names.includes('logistics')) return 'logistics';
  if (names.includes('operations')) return 'operations';
  return 'crew';
}

/** Laravel `paginate()` JSON shape */
export type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number | null;
  to?: number | null;
};

export interface Event {
  id: number;
  name: string;
  description?: string;
  date: string;
  end_date?: string | null;
  start_time: string;
  expected_end_time?: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  geofence_radius: number;
  daily_allowance?: number | null;
  team_leader_id?: number;
  created_by_id?: number;
  status: string;
  closed_at?: string | null;
  closed_by?: number | null;
  closing_comment?: string | null;
  team_leader?: { id: number; name: string };
  teamLeader?: { id: number; name: string };
  closedBy?: { id: number; name: string } | null;
  crew?: { id: number; name: string; pivot?: { checkin_time?: string; checkout_time?: string; role_in_event?: string | null; total_hours?: number | null; standard_hours?: number | null; extra_hours?: number | null; hours_status?: 'not_checked_in' | 'within_standard' | 'in_extra_hours' | 'checked_out'; is_sunday?: boolean; is_holiday?: boolean; holiday_name?: string | null; is_paused?: boolean; pause_duration?: number; pause_reason?: string | null; transport_type?: 'organization' | 'cab' | 'none' | null; transport_amount?: number | null } }[];
}

export interface TimeOffRequestAttachment {
  id: number;
  time_off_request_id: number;
  path: string;
  original_name?: string;
  url?: string;
}

export interface TimeOffRequest {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  reason?: string;
  notes?: string;
  status: string;
  attachments?: TimeOffRequestAttachment[];
}

export interface Client {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  created_at?: string;
}

export interface Equipment {
  id: number;
  name: string;
  description?: string;
  quantity?: number;
  created_at?: string;
}

export interface Payment {
  id: number;
  event_id: number;
  user_id: number;
  hours?: number;
  per_diem?: number;
  allowances?: number;
  total_amount: number;
  status: string;
  purpose?: string | null;
  payment_date?: string | null;
  created_at?: string;
  event?: { id: number; name: string } | null;
  user?: { id: number; name: string } | null;
}

export interface AllowanceTypeItem {
  id: number;
  name: string;
  is_active: boolean;
}

export interface EarnedAllowanceDetail {
  id: number;
  event_id?: number;
  event_name?: string | null;
  crew_id: number;
  crew_name: string;
  allowance_type_id: number;
  allowance_type: string;
  amount: number;
  description?: string | null;
  recorded_by?: string | null;
  recorded_at?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  source?: string | null;
  attachment_url?: string | null;
  rejection_comment?: string | null;
  approval_comment?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  meal_slot?: string | null;
  meal_grant_date?: string | null;
}

export interface EarnedAllowanceEventGroup {
  event_id: number;
  event_name: string;
  event_date?: string | null;
  location?: string | null;
  team_lead?: string | null;
  crew_count: number;
  total_allowances: number;
  status_breakdown: { pending: number; approved: number; rejected?: number; paid: number };
  details: EarnedAllowanceDetail[];
}

export interface Communication {
  id: number;
  title?: string;
  subject?: string;
  body?: string;
  target?: string;
  recipient_scope?: 'all_staff' | 'crew' | 'event_crew';
  event_id?: number | null;
  sent_at?: string | null;
  created_at?: string;
  send_as_message?: boolean;
  send_as_email?: boolean;
  sent_by_id?: number | null;
  sent_by?: { id: number; name: string; email?: string } | null;
  sentBy?: { id: number; name: string; email?: string } | null;
  event?: { id: number; name: string; date?: string } | null;
  recipient_count?: number;
  opened_count?: number;
  unopened_count?: number;
  recipients_status?: {
    user_id: number;
    name: string;
    email?: string;
    opened: boolean;
    opened_at?: string | null;
  }[];
}

export interface ReportsData {
  [key: string]: unknown;
}

export type ReportType = 'events' | 'crew-attendance' | 'crew-payments' | 'tasks' | 'financial' | 'end-of-day';

export interface ReportFilters {
  date_from?: string;
  date_to?: string;
  month?: number;
  year?: number;
  date?: string;
  event_id?: number;
  user_id?: number;
  per_page?: number;
  page?: number;
  confirmed_by?: string;
  signature?: string;
}

function reportParams(f?: ReportFilters | null): Record<string, string> | undefined {
  if (!f) return undefined;
  const out: Record<string, string> = {};
  if (f.date_from) out.date_from = f.date_from;
  if (f.date_to) out.date_to = f.date_to;
  if (f.month != null) out.month = String(f.month);
  if (f.year != null) out.year = String(f.year);
  if (f.date) out.date = f.date;
  if (f.event_id != null) out.event_id = String(f.event_id);
  if (f.user_id != null) out.user_id = String(f.user_id);
  if (f.per_page != null) out.per_page = String(f.per_page);
  if (f.page != null) out.page = String(f.page);
  if (f.confirmed_by) out.confirmed_by = f.confirmed_by;
  if (f.signature) out.signature = f.signature;
  return Object.keys(out).length ? out : undefined;
}

export interface ReportEventsResponse {
  summary: { total_events: number; by_status: Record<string, number> };
  by_day: { date: string; count: number }[];
  data: Event[];
  pagination?: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface ReportCrewAttendanceResponse {
  summary: {
    total_assignments: number;
    total_checkins: number;
    missed_checkins: number;
    participation_rate: number;
    total_hours: number;
  };
  by_day: { date: string; checkins: number; hours: number }[];
  data: unknown[];
  pagination?: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface ReportCrewPaymentsResponse {
  summary: {
    total_count: number;
    pending_count: number;
    pending_total: number;
    approved_count: number;
    approved_total: number;
    rejected_count: number;
    rejected_total: number;
    grand_total: number;
  };
  data: unknown[];
  pagination?: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface ReportTasksResponse {
  summary: { total: number; pending: number; in_progress: number; completed: number };
  data: TaskItem[];
  pagination?: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface ReportFinancialResponse {
  summary: { total_payments: number; total_amount: number; by_status: Record<string, { count: number; total: number }> };
  by_day: { date: string; count: number; total: number }[];
  data?: unknown[];
  pagination?: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface ReportEndOfDayResponse {
  summary: {
    events_count: number;
    crew_allowances_total: number;
    other_expenses_total: number;
    grand_total: number;
  };
  data: {
    event_id: number;
    event_name: string;
    date: string;
    crew_allowances: number;
    other_expenses: number;
    total: number;
  }[];
}

export interface AuditLogEntry {
  id: number;
  user_id?: number;
  action: string;
  model_type?: string;
  model_id?: number;
  changes?: string;
  created_at: string;
}
