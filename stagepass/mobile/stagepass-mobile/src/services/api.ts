/**
 * Stagepass API client – REST API consumed by the mobile app.
 * Uses Laravel Sanctum token for auth.
 *
 * Set EXPO_PUBLIC_API_URL in .env or app config:
 * - iOS simulator / web: http://localhost:8000
 * - Android emulator:    http://10.0.2.2:8000
 * - Physical device:    http://<your-pc-ip>:8000  (e.g. http://192.168.1.5:8000)
 */

import { Platform } from 'react-native';

function getDefaultApiBase(): string {
  if (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Android emulator: localhost is the emulator; 10.0.2.2 is the host machine
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
}

const API_BASE = getDefaultApiBase();

export const getApiBase = () => API_BASE;

export type ApiConfig = {
  token: string | null;
};

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}
/** Call when 401 is received – app can clear token, Redux, and redirect to login */
export function setOnUnauthorized(callback: (() => void) | null) {
  onUnauthorized = callback;
}

export function getAuthToken() {
  return authToken;
}

const LOG = true; // set to false to reduce logs

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
  const urlStr = url.toString();
  if (LOG) {
    console.warn('[Stagepass API]', init.method ?? 'GET', urlStr);
  }
  try {
    const res = await fetch(urlStr, { ...init, headers });
    const data = await res.json().catch(() => ({}));
    if (LOG) {
      console.warn('[Stagepass API]', res.status, path, res.ok ? 'OK' : 'FAIL', data?.message ?? '');
    }
    if (!res.ok) {
      if (res.status === 401) {
        setAuthToken(null);
        onUnauthorized?.();
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
        setAuthToken(null);
        onUnauthorized?.();
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
    forgotPassword: (email: string) =>
      request<{ message: string }>('/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    logout: () => request<{ message: string }>('/logout', { method: 'POST' }),
    me: () => request<User>('/me'),
    /** Update current user profile (name, email, phone, address, optional password, optional PIN) */
    updateProfile: (body: {
      name?: string;
      email?: string;
      phone_number?: string;
      address?: string;
      emergency_contact?: string;
      password?: string;
      password_confirmation?: string;
      current_pin?: string;
      new_pin?: string;
      new_pin_confirmation?: string;
    }) => request<User>('/me', { method: 'PATCH', body: JSON.stringify(body) }),
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
    /** List events. Backend returns only assigned for crew; admins get all. */
    list: (params?: { status?: string; page?: number; per_page?: number }) =>
      request<{ data: Event[] }>('/events', { params: params as Record<string, string> | undefined }),
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
    /** Admin/team leader: end event with comment */
    end: (eventId: number, body: { end_comment: string }) =>
      request<Event>(`/events/${eventId}/end`, { method: 'POST', body: JSON.stringify(body) }),
  },
  /** Optional: two-step auth verify PIN (if backend supports POST /verify-pin) */
  authVerifyPin: (pin: string) =>
    request<{ token: string; user: User }>('/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),
  attendance: {
    checkin: (eventId: number, latitude: number, longitude: number) =>
      request<{ checkin_time: string }>('/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({
          event_id: eventId,
          latitude,
          longitude,
          timestamp: new Date().toISOString(),
        }),
      }),
    /** Admin/team leader: check in a crew member on their behalf (manual check-in) */
    checkinOnBehalf: (eventId: number, userId: number, _latitude?: number, _longitude?: number) =>
      request<{ checkin_time: string }>(`/events/${eventId}/attendance/manual-checkin/${userId}`, {
        method: 'POST',
      }),
    checkout: (eventId: number) =>
      request<{ checkout_time: string; total_hours: number }>('/attendance/checkout', {
        method: 'POST',
        body: JSON.stringify({ event_id: eventId }),
      }),
  },
  timeOff: {
    request: (startDate: string, endDate: string, reason?: string) =>
      request<TimeOffRequest>('/timeoff/request', {
        method: 'POST',
        body: JSON.stringify({ start_date: startDate, end_date: endDate, reason }),
      }),
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
    list: () => request<{ data: Payment[] }>('/payments'),
    approve: (paymentId: number) =>
      request<Payment>('/payments/approve', { method: 'POST', body: JSON.stringify({ payment_id: paymentId }) }),
    reject: (paymentId: number, reason?: string) =>
      request<Payment>('/payments/reject', {
        method: 'POST',
        body: JSON.stringify({ payment_id: paymentId, rejection_reason: reason }),
      }),
  },
  /** Crew: my tasks (GET /api/my-tasks) */
  myTasks: () => request<{ data: MyTask[] }>('/my-tasks'),
  taskComplete: (taskId: number, body?: { comment?: string; photo_url?: string }) =>
    request<MyTask>(`/task/${taskId}/complete`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  /** Crew: my checklists (GET /api/my-checklists) */
  myChecklists: () => request<{ data: MyChecklist[] }>('/my-checklists'),
  checklistUpdate: (itemId: number, body: { is_checked: boolean; note?: string; photo_url?: string }) =>
    request<unknown>('/checklist/update', { method: 'POST', body: JSON.stringify({ checklist_item_id: itemId, ...body }) }),
  /** Leader: crew status for event */
  eventCrewStatus: (eventId: number) =>
    request<{ data: CrewStatusItem[] }>(`/events/${eventId}/crew-status`),
  /** Leader: checklist progress */
  eventChecklistProgress: (eventId: number) =>
    request<{ data: ChecklistProgressItem[] }>(`/events/${eventId}/checklist-progress`),
  /** Leader: report issue */
  eventReportIssue: (eventId: number, body: { title: string; description?: string; severity?: string; photo_url?: string }) =>
    request<unknown>(`/events/${eventId}/report-issue`, { method: 'POST', body: JSON.stringify(body) }),
  /** Leader: send message to crew */
  eventMessage: (eventId: number, body: { target: 'all' | 'department' | 'user'; department?: string; user_id?: number; message: string }) =>
    request<unknown>(`/events/${eventId}/message`, { method: 'POST', body: JSON.stringify(body) }),
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
    get: (params?: { from?: string; to?: string }) =>
      request<ReportsData>('/reports', { params: params as Record<string, string> | undefined }),
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
    create: (body: { title: string; body?: string; target?: string }) =>
      request<Communication>('/communications', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: number) => request<unknown>(`/communications/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get: () => request<Record<string, unknown>>('/settings'),
    update: (body: Record<string, unknown>) =>
      request<Record<string, unknown>>('/settings', { method: 'PUT', body: JSON.stringify(body) }),
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

export interface MyChecklist {
  id: number;
  event_id: number;
  items: { id: number; label: string; is_checked: boolean; sort_order: number }[];
}

export interface CrewStatusItem {
  user_id: number;
  name: string;
  department?: string;
  status: 'checked_in' | 'late' | 'pending' | 'checked_out';
  checkin_time?: string;
}

export interface ChecklistProgressItem {
  checklist_id: number;
  total: number;
  completed: number;
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
  phone_number?: string;
  address?: string;
  emergency_contact?: string;
}

/** Resolve app role from backend role names. */
export function getRole(user: User | null): RoleName {
  if (!user?.roles?.length) return 'crew';
  const names = user.roles.map((r) => r.name);
  if (names.includes('super_admin') || names.includes('director')) return 'admin';
  if (names.includes('team_leader')) return 'team_leader';
  if (names.includes('accountant')) return 'accountant';
  if (names.includes('logistics')) return 'logistics';
  if (names.includes('operations')) return 'operations';
  return 'crew';
}

export interface Event {
  id: number;
  name: string;
  description?: string;
  date: string;
  start_time: string;
  expected_end_time?: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  geofence_radius: number;
  team_leader_id?: number;
  status: string;
  team_leader?: { id: number; name: string };
  teamLeader?: { id: number; name: string };
  crew?: { id: number; name: string; pivot?: { checkin_time?: string; checkout_time?: string } }[];
}

export interface TimeOffRequest {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  reason?: string;
  status: string;
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
  hours: number;
  per_diem: number;
  allowances: number;
  total_amount: number;
  status: string;
  created_at?: string;
}

export interface Communication {
  id: number;
  title: string;
  body?: string;
  target?: string;
  created_at?: string;
}

export interface ReportsData {
  [key: string]: unknown;
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
