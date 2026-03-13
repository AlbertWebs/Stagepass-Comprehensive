/**
 * Stagepass API client for web admin.
 * Uses same Laravel API as mobile (Sanctum).
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('stagepass_admin_token');
}

function setToken(token: string | null) {
  if (token) localStorage.setItem('stagepass_admin_token', token);
  else localStorage.removeItem('stagepass_admin_token');
}

export { getToken, setToken };

function buildParams(params: Record<string, string | number | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    out[k] = String(v);
  }
  return out;
}

async function request<T>(
  path: string,
  options: RequestInit & { params?: Record<string, string | number | undefined> } = {}
): Promise<T> {
  const { params, ...init } = options;
  const url = path.startsWith('http') ? path : `${API_BASE}/api${path}`;
  const clean = params ? buildParams(params) : null;
  const fullUrl = clean && Object.keys(clean).length > 0 ? `${url}?${new URLSearchParams(clean)}` : url;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(init.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(fullUrl, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const body = data as { message?: string; errors?: Record<string, string[]> };
    const firstErrors = body.errors
      ? Object.values(body.errors).flat().filter(Boolean)
      : [];
    const message = firstErrors.length
      ? firstErrors.join(' ')
      : body.message || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export interface Role {
  id: number;
  name: string;
  label?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  username?: string;
  roles?: Role[];
}

export interface EventEquipmentAssignment {
  id: number;
  equipment_id: number;
  equipment?: EquipmentItem;
}

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
  team_leader_id?: number;
  client_id?: number | null;
  status: string;
  team_leader?: User;
  client?: Client | null;
  crew?: User[];
  event_equipment?: EventEquipmentAssignment[];
  ended_at?: string | null;
  ended_by_id?: number | null;
  end_comment?: string | null;
  ended_by?: User | null;
}

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface Client {
  id: number;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  events_count?: number;
}

export interface CommunicationItem {
  id: number;
  sent_by_id: number;
  subject: string;
  body: string;
  recipient_scope: string;
  event_id: number | null;
  send_as_message: boolean;
  send_as_email: boolean;
  sent_at: string | null;
  created_at: string;
  sent_by?: User;
  event?: Event;
}

export interface EquipmentItem {
  id: number;
  name: string;
  serial_number?: string;
  condition: string;
}

export type VehicleStatus = 'available' | 'in_use' | 'maintenance';

export interface Vehicle {
  id: number;
  name: string;
  registration_number?: string | null;
  capacity?: number | null;
  status: VehicleStatus;
  notes?: string | null;
}

export interface TransportAssignment {
  id: number;
  event_id: number;
  vehicle_id: number;
  driver_id?: number | null;
  notes?: string | null;
  event?: { id: number; name: string; date: string; status?: string };
  vehicle?: Vehicle;
  driver?: User | null;
}

export interface EventChecklistItem {
  id: number;
  event_id: number;
  type: 'crew' | 'equipment';
  source_id: number | null;
  label: string;
  sort_order: number;
  is_checked: boolean;
  checked_at: string | null;
  checked_by_id: number | null;
  checked_by?: User | null;
}

/** Purpose for payment allocation (e.g. fair, lunch, dinner) */
export const PAYMENT_PURPOSES = ['fair', 'lunch', 'dinner', 'transport', 'accommodation', 'other'] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

export interface PaymentItem {
  id: number;
  event_id: number;
  user_id: number;
  purpose?: string | null;
  hours: number;
  per_diem: number;
  allowances: number;
  total_amount: number;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: number;
  approved_at?: string;
  rejection_reason?: string | null;
  created_at?: string;
  event?: Event;
  user?: User;
  approved_by_user?: User;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: User }>('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => request<{ message: string }>('/logout', { method: 'POST' }),
    me: () => request<User>('/me'),
    updateProfile: (body: { name?: string; email?: string; password?: string; password_confirmation?: string }) =>
      request<User>('/me', { method: 'PATCH', body: JSON.stringify(body) }),
  },
  backup: {
    get: () => request<{ exported_at: string; users: unknown[]; events: unknown[]; equipment: unknown[] }>('/backup'),
  },
  dangerZone: {
    /** Wipe all tables except users and user-related (roles, permissions, sessions, etc.). Admin only. */
    wipeNonUserData: () =>
      request<{ message: string; wiped_tables: string[] }>('/danger-zone/wipe-non-user-data', { method: 'POST' }),
  },
  settings: {
    get: () =>
      request<Record<string, string | number | boolean | null>>('/settings', {
        params: { _: String(Date.now()) },
      }),
    update: (settings: Record<string, string | number | boolean | null>) =>
      request<Record<string, string | number | boolean | null>>('/settings', {
        method: 'POST',
        body: JSON.stringify({ settings }),
      }),
  },
  roles: {
    list: () => request<Role[]>('/roles'),
  },
  users: {
    list: (params?: { search?: string; role?: string; page?: number; per_page?: number }) =>
      request<Paginated<User>>('/users', { params: params as Record<string, string | number> }),
    get: (id: number) => request<User>(`/users/${id}`),
    create: (body: { name: string; email: string; password: string; username?: string; pin?: string; phone?: string; role_ids?: number[] }) =>
      request<User>('/users', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: { name?: string; email?: string; password?: string; username?: string; pin?: string; phone?: string; role_ids?: number[] }) =>
      request<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/users/${id}`, { method: 'DELETE' }),
  },
  clients: {
    list: (params?: { search?: string; page?: number; per_page?: number }) =>
      request<Paginated<Client>>('/clients', { params: params as Record<string, string> }),
    get: (id: number) => request<Client>(`/clients/${id}`),
    create: (body: { name: string; contact_name?: string; email?: string; phone?: string; address?: string; notes?: string }) =>
      request<Client>('/clients', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: { name?: string; contact_name?: string; email?: string; phone?: string; address?: string; notes?: string }) =>
      request<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/clients/${id}`, { method: 'DELETE' }),
  },
  events: {
    list: (params?: { status?: string; page?: number; per_page?: number }) =>
      request<Paginated<Event>>('/events', { params: params as Record<string, string> }),
    get: (id: number) => request<Event>(`/events/${id}`),
    create: (body: Partial<Event>) =>
      request<Event>('/events', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Event>) =>
      request<Event>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/events/${id}`, { method: 'DELETE' }),
    assignUser: (eventId: number, userId: number, roleInEvent?: string) =>
      request<unknown>(`/events/${eventId}/assign-user`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, role_in_event: roleInEvent }),
      }),
    manualCheckin: (eventId: number, userId: number) =>
      request<{ message: string; checkin_time: string }>(
        `/events/${eventId}/attendance/manual-checkin/${userId}`,
        { method: 'POST' }
      ),
    removeUser: (eventId: number, userId: number) =>
      request<void>(`/events/${eventId}/crew/${userId}`, { method: 'DELETE' }),
    transferUser: (eventId: number, userId: number, targetEventId: number) =>
      request<{ message: string; target_event_id: number }>(`/events/${eventId}/transfer-user`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, target_event_id: targetEventId }),
      }),
    attachEquipment: (eventId: number, equipmentId: number, notes?: string) =>
      request<EventEquipmentAssignment>(`/events/${eventId}/equipment`, {
        method: 'POST',
        body: JSON.stringify({ equipment_id: equipmentId, notes: notes || undefined }),
      }),
    notes: (eventId: number) => request<Paginated<{ id: number; note: string; user: User }>>(`/events/${eventId}/notes`),
    end: (eventId: number, body: { end_comment: string }) =>
      request<Event>(`/events/${eventId}/end`, { method: 'POST', body: JSON.stringify(body) }),
    checklist: {
      list: (eventId: number) =>
        request<{ data: EventChecklistItem[] }>(`/events/${eventId}/checklist`),
      create: (eventId: number) =>
        request<{ data: EventChecklistItem[] }>(`/events/${eventId}/checklist`, { method: 'POST' }),
      toggleItem: (eventId: number, itemId: number, isChecked: boolean) =>
        request<EventChecklistItem>(`/events/${eventId}/checklist/${itemId}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_checked: isChecked }),
        }),
    },
  },
  equipment: {
    list: (params?: { search?: string; page?: number; per_page?: number }) =>
      request<Paginated<EquipmentItem>>('/equipment', {
        params: params as Record<string, string | number>,
      }),
    get: (id: number) => request<EquipmentItem>(`/equipment/${id}`),
    create: (body: { name: string; serial_number?: string; condition: string }) =>
      request<EquipmentItem>('/equipment', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: { name?: string; serial_number?: string; condition?: string }) =>
      request<EquipmentItem>(`/equipment/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/equipment/${id}`, { method: 'DELETE' }),
  },
  vehicles: {
    list: (params?: { search?: string; status?: VehicleStatus; page?: number; per_page?: number }) =>
      request<Paginated<Vehicle>>('/vehicles', {
        params: params as Record<string, string | number>,
      }),
    get: (id: number) => request<Vehicle>(`/vehicles/${id}`),
    create: (body: { name: string; registration_number?: string; capacity?: number; status?: VehicleStatus; notes?: string }) =>
      request<Vehicle>('/vehicles', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: { name?: string; registration_number?: string; capacity?: number; status?: VehicleStatus; notes?: string }) =>
      request<Vehicle>(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/vehicles/${id}`, { method: 'DELETE' }),
  },
  transport: {
    listAssignments: (params?: { event_id?: number; page?: number; per_page?: number }) =>
      request<Paginated<TransportAssignment>>('/transport/assignments', {
        params: params as Record<string, string | number>,
      }),
    assignToEvent: (eventId: number, body: { vehicle_id: number; driver_id?: number | null; notes?: string | null }) =>
      request<TransportAssignment>(`/events/${eventId}/transport`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    removeAssignment: (assignmentId: number) =>
      request<void>(`/transport/assignments/${assignmentId}`, { method: 'DELETE' }),
  },
  payments: {
    list: (params?: { status?: string; event_id?: number; page?: number }) =>
      request<Paginated<PaymentItem>>('/payments', {
        params: params as Record<string, string | number>,
      }),
    initiate: (body: { event_id: number; user_id: number; purpose?: string | null; payment_date?: string; amount?: number; hours?: number; per_diem?: number; allowances?: number }) =>
      request<PaymentItem>('/payments/initiate', { method: 'POST', body: JSON.stringify(body) }),
    approve: (paymentId: number) =>
      request<PaymentItem>('/payments/approve', {
        method: 'POST',
        body: JSON.stringify({ payment_id: paymentId }),
      }),
    reject: (paymentId: number, rejectionReason?: string) =>
      request<PaymentItem>('/payments/reject', {
        method: 'POST',
        body: JSON.stringify({ payment_id: paymentId, rejection_reason: rejectionReason }),
      }),
  },
  reports: {
    get: (from: string, to: string) =>
      request<ReportsData>('/reports', { params: { from, to } }),
  },
  checkins: {
    serverDate: () =>
      request<{ date: string; timezone: string }>('/checkins/server-date'),
    list: (params: { from?: string; to?: string; date?: string }) =>
      request<CheckinsResponse>('/checkins', { params: params as Record<string, string> }),
    dailyStatus: (date: string) =>
      request<DailyStatusResponse>('/checkins/daily-status', { params: { date } }),
    setEmployeeOff: (userId: number, date: string, off: boolean) =>
      request<{ message: string; ok?: boolean }>('/checkins/set-employee-off', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, date, off }),
      }),
    sendPush: (userId: number, title?: string, body?: string) =>
      request<{ message: string; ok?: boolean }>('/checkins/send-push', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, title: title ?? undefined, body: body ?? undefined }),
      }),
  },
  communications: {
    list: (params?: { page?: number; per_page?: number }) =>
      request<Paginated<CommunicationItem>>('/communications', { params: params as Record<string, number> }),
    get: (id: number) => request<CommunicationItem>(`/communications/${id}`),
    send: (body: {
      subject: string;
      body: string;
      recipient_scope: 'all_staff' | 'crew' | 'event_crew';
      event_id?: number | null;
      send_as_message: boolean;
      send_as_email: boolean;
    }) =>
      request<CommunicationItem>('/communications', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/communications/${id}`, { method: 'DELETE' }),
  },
  docs: {
    listGuides: () =>
      request<{ guides: { id: string; title: string }[] }>('/docs/guides'),
    getGuide: (name: string) =>
      request<{ id: string; title: string; content: string }>(`/docs/guides/${encodeURIComponent(name)}`),
  },
  auditLogs: {
    list: (params?: {
      user_id?: number;
      source?: string;
      date_from?: string;
      date_to?: string;
      method?: string;
      path?: string;
      status?: number;
      page?: number;
      per_page?: number;
    }) =>
      request<Paginated<AuditLogItem>>('/audit-logs', {
        params: params as Record<string, string | number>,
      }),
  },
  timeoff: {
    list: (params?: { status?: string; page?: number; per_page?: number; user_id?: number }) =>
      request<Paginated<TimeOffRequestItem>>('/timeoff', {
        params: params as Record<string, string | number>,
      }),
    create: (body: { user_id: number; start_date: string; end_date: string; reason?: string | null; notes?: string | null; status?: 'pending' | 'approved' | 'rejected' }) =>
      request<TimeOffRequestItem>('/timeoff', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: { start_date?: string; end_date?: string; reason?: string | null; notes?: string | null; status?: 'pending' | 'approved' | 'rejected' }) =>
      request<TimeOffRequestItem>(`/timeoff/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    approve: (requestId: number) =>
      request<TimeOffRequestItem>('/timeoff/approve', {
        method: 'POST',
        body: JSON.stringify({ request_id: requestId }),
      }),
    reject: (requestId: number) =>
      request<TimeOffRequestItem>('/timeoff/reject', {
        method: 'POST',
        body: JSON.stringify({ request_id: requestId }),
      }),
  },
  tasks: {
    list: (params?: { event_id?: number; user_id?: number; status?: string; search?: string; page?: number; per_page?: number }) =>
      request<Paginated<TaskItem>>('/tasks', {
        params: params as Record<string, string | number>,
      }),
    get: (id: number) => request<TaskItem>(`/tasks/${id}`),
    create: (body: { title: string; description?: string; event_id?: number; priority?: TaskPriority; due_date?: string; notes?: string; assignee_ids?: number[] }) =>
      request<TaskItem>('/tasks', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<{ title: string; description?: string; event_id?: number; priority?: TaskPriority; due_date?: string; status?: TaskStatus; notes?: string; assignee_ids?: number[] }>) =>
      request<TaskItem>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
  },
};

export interface AuditLogItem {
  id: number;
  user_id: number | null;
  method: string;
  path: string;
  full_url: string | null;
  source: string;
  ip_address: string | null;
  user_agent: string | null;
  response_status: number | null;
  created_at: string;
  user?: User | null;
}

export interface TimeOffRequestItem {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  reason: string | null;
  notes?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  processed_by: number | null;
  processed_at: string | null;
  created_at: string;
  user?: User;
  processedBy?: User;
}

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface TaskItem {
  id: number;
  title: string;
  description: string | null;
  event_id: number | null;
  created_by: number | null;
  priority: TaskPriority;
  due_date: string | null;
  status: TaskStatus;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  event?: { id: number; name: string; date?: string } | null;
  creator?: { id: number; name: string } | null;
  assignees?: { id: number; name: string }[];
}

export interface CheckinItem {
  type: 'office' | 'event';
  id: string;
  date: string;
  checkin_time: string;
  checkin_time_iso?: string;
  user_id: number;
  user_name: string;
  user_email?: string | null;
  event_id?: number | null;
  event_name?: string | null;
  location: string;
}

export interface CheckinsResponse {
  summary: {
    total: number;
    office: number;
    event: number;
    from: string;
    to: string;
  };
  checkins: CheckinItem[];
}

export interface DailyEmployeeStatusItem {
  user_id: number;
  user_name: string;
  user_email: string | null;
  checked_in: boolean;
  checkin_time: string | null;
  checkin_time_iso: string | null;
  is_off: boolean;
  expected_to_report: boolean;
}

export interface DailyStatusResponse {
  date: string;
  employees: DailyEmployeeStatusItem[];
}

export interface ReportsData {
  financial: {
    summary: {
      total_payments: number;
      total_amount: number;
      by_status: Record<string, { count: number; total: number }>;
    };
    by_day: { date: string; count: number; total: number }[];
  };
  attendance: {
    summary: { total_checkins: number; total_hours: number };
    by_day: { date: string; checkins: number; hours: number }[];
  };
  events: {
    summary: { total_events: number; by_status: Record<string, number> };
    by_day: { date: string; count: number }[];
  };
  arrival: {
    summary: { total_arrivals: number };
    by_day: { date: string; count: number }[];
    by_event: { event: string; arrivals: number }[];
  };
}
