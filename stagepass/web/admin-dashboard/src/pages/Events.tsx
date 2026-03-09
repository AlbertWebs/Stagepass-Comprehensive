import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Client, type Event, type Paginated, type User } from '@/services/api';
import { FormModal } from '@/components/FormModal';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

const STATUS_OPTIONS = [
  { value: 'created', label: 'Created' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
];

type EventFormState = {
  name: string;
  description: string;
  date: string;
  start_time: string;
  expected_end_time: string;
  location_name: string;
  geofence_radius: number;
  team_leader_id: string;
  client_id: string;
  status: string;
};

function emptyForm(): EventFormState {
  const today = new Date();
  const date = today.toISOString().slice(0, 10);
  return {
    name: '',
    description: '',
    date,
    start_time: '09:00',
    expected_end_time: '',
    location_name: '',
    geofence_radius: 100,
    team_leader_id: '',
    client_id: '',
    status: 'created',
  };
}

function eventToForm(e: Event): EventFormState {
  return {
    name: e.name,
    description: e.description ?? '',
    date: e.date?.toString().slice(0, 10) ?? '',
    start_time: e.start_time?.toString().slice(0, 5) ?? '',
    expected_end_time: e.expected_end_time?.toString().slice(0, 5) ?? '',
    location_name: e.location_name ?? '',
    geofence_radius: e.geofence_radius ?? 100,
    team_leader_id: e.team_leader_id ? String(e.team_leader_id) : '',
    client_id: e.client_id != null ? String(e.client_id) : '',
    status: e.status ?? 'created',
  };
}

export default function Events() {
  const [data, setData] = useState<Paginated<Event> | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [deleteEvent, setDeleteEvent] = useState<Event | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<EventFormState>(emptyForm());
  const [pageLoading, setPageLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const fetchEvents = useCallback(() => {
    setListError(null);
    setPageLoading(true);
    api.events
      .list({ status: status || undefined, page })
      .then((res) => {
        setData(res);
        setListError(null);
      })
      .catch((err) => {
        setData(null);
        setListError(err instanceof Error ? err.message : 'Failed to load events.');
      })
      .finally(() => setPageLoading(false));
  }, [status, page]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    api.users.list({}).then((r) => setUsers(r.data ?? [])).catch(() => setUsers([]));
  }, []);
  useEffect(() => {
    api.clients.list({ per_page: 500 }).then((r) => setClients(r.data ?? [])).catch(() => setClients([]));
  }, []);

  const events = Array.isArray(data?.data) ? data.data : [];
  const showPreloader = pageLoading && !data;

  const openCreate = () => {
    setForm(emptyForm());
    setError(null);
    setCreateOpen(true);
  };

  const openEdit = (e: Event) => {
    setForm(eventToForm(e));
    setError(null);
    setEditEvent(e);
  };

  const isFormOpen = createOpen || Boolean(editEvent);
  useEffect(() => {
    if (isFormOpen) {
      const t = setTimeout(() => firstInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isFormOpen]);

  const closeModals = () => {
    setCreateOpen(false);
    setEditEvent(null);
    setDeleteEvent(null);
    setError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.events.create({
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        date: form.date,
        start_time: form.start_time,
        expected_end_time: form.expected_end_time || undefined,
        location_name: form.location_name?.trim() || undefined,
        geofence_radius: form.geofence_radius,
        team_leader_id: form.team_leader_id ? Number(form.team_leader_id) : undefined,
        client_id: form.client_id ? Number(form.client_id) : undefined,
      });
      closeModals();
      setPage(1);
      setStatus('');
      const list = await api.events.list({ page: 1 });
      setData(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEvent) return;
    setSaving(true);
    setError(null);
    try {
      await api.events.update(editEvent.id, {
        name: form.name,
        description: form.description || undefined,
        date: form.date,
        start_time: form.start_time,
        expected_end_time: form.expected_end_time || undefined,
        location_name: form.location_name || undefined,
        geofence_radius: form.geofence_radius,
        team_leader_id: form.team_leader_id ? Number(form.team_leader_id) : undefined,
        client_id: form.client_id ? Number(form.client_id) : undefined,
        status: form.status,
      });
      closeModals();
      fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteEvent) return;
    setSaving(true);
    try {
      await api.events.delete(deleteEvent.id);
      closeModals();
      fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setSaving(false);
    }
  };

  const formFields = (
    <div className="form-card-body py-4">
      {error && <div className="form-error-banner mb-4">{error}</div>}
      <form onSubmit={editEvent ? handleUpdate : handleCreate} className="space-y-4">
        {/* Row 1: Event name */}
        <div className="form-field">
          <label className="form-label" htmlFor="event-name">Event name *</label>
          <input
            ref={firstInputRef}
            id="event-name"
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="form-input"
            placeholder="Event name"
          />
        </div>
        {/* Row 2: Date, Start, End */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="form-field">
            <label className="form-label" htmlFor="event-date">Date *</label>
            <input
              id="event-date"
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="form-input"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="event-start-time">Start *</label>
            <input
              id="event-start-time"
              type="time"
              required
              value={form.start_time}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              className="form-input"
            />
          </div>
          <div className="form-field">
            <label className="form-label form-label-optional" htmlFor="event-end-time">End</label>
            <input
              id="event-end-time"
              type="time"
              value={form.expected_end_time}
              onChange={(e) => setForm((f) => ({ ...f, expected_end_time: e.target.value }))}
              className="form-input"
            />
          </div>
        </div>
        {/* Row 3: Location & Geofence */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="form-field">
            <label className="form-label form-label-optional" htmlFor="event-location">Location</label>
            <input
              id="event-location"
              type="text"
              value={form.location_name}
              onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))}
              className="form-input"
              placeholder="Venue or address"
            />
          </div>
          <div className="form-field">
            <label className="form-label form-label-optional" htmlFor="event-geofence">Geofence (m)</label>
            <input
              id="event-geofence"
              type="number"
              min={50}
              max={5000}
              value={form.geofence_radius}
              onChange={(e) => setForm((f) => ({ ...f, geofence_radius: Number(e.target.value) || 100 }))}
              className="form-input"
            />
          </div>
        </div>
        {/* Client (optional) */}
        <div className="form-field">
          <label className="form-label form-label-optional" htmlFor="event-client">Client</label>
          <select
            id="event-client"
            value={form.client_id}
            onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
            className="form-select"
          >
            <option value="">No client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.contact_name ? ` (${c.contact_name})` : ''}
              </option>
            ))}
          </select>
        </div>
        {/* Description + Edit-only Status */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="form-field">
            <label className="form-label form-label-optional" htmlFor="event-description">Description</label>
            <input
              id="event-description"
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="form-input"
              placeholder="Short description (optional)"
            />
          </div>
          {editEvent && (
            <div className="form-field">
              <label className="form-label" htmlFor="event-status">Status</label>
              <select
                id="event-status"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="form-select"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="form-actions pt-2">
          <button type="button" onClick={closeModals} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50">
            {saving ? 'Saving…' : editEvent ? 'Update event' : 'Create event'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      {showPreloader && <Preloader message="Loading events…" fullScreen />}
      <div className="space-y-6">
      <PageHeader
        title="Events"
        subtitle="Create and manage events. Filter by status, edit or delete events."
        action={
          <button type="button" onClick={openCreate} className="btn-brand">
            Create event
          </button>
        }
      />

      {listError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
          role="alert"
        >
          <span>{listError}</span>
          <button
            type="button"
            onClick={() => fetchEvents()}
            className="inline-flex items-center rounded-lg bg-red-100 px-3 py-1.5 font-medium text-red-800 hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="form-select w-auto min-w-[10rem]"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <SectionCard sectionLabel="Upcoming & past events">
        <>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full table-header-brand">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Date</th>
                    <th>Location</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                      <td className="px-6 py-4 font-medium text-slate-900">{e.name}</td>
                      <td className="px-6 py-4 text-slate-600">{e.date}</td>
                      <td className="px-6 py-4 text-slate-600">{e.location_name ?? '–'}</td>
                      <td className="px-6 py-4 text-slate-600">{e.client ? e.client.name : '–'}</td>
                      <td className="px-6 py-4">
                        <span className="chip-brand capitalize">{e.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex gap-3">
                          <Link to={`/events/${e.id}`} className="link-brand">
                            View
                          </Link>
                          <button type="button" onClick={() => openEdit(e)} className="link-brand">
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDeleteEvent(e); setError(null); }}
                            className="text-sm font-medium text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!pageLoading && events.length === 0 && (
              <p className="px-6 py-12 text-center text-sm text-brand-600">
                No events found. Create an event to get started.
              </p>
            )}
        {data && data.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200/80 px-6 py-3.5">
            <p className="text-sm text-slate-600">
              Page {data.current_page} of {data.last_page} ({data.total} total)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={data.current_page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-pagination"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={data.current_page >= data.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="btn-pagination"
              >
                Next
              </button>
            </div>
          </div>
        )}
        </>
      </SectionCard>

      {createOpen && (
        <FormModal title="Create event" onClose={closeModals} wide scrollable={false}>
          {formFields}
        </FormModal>
      )}

      {editEvent && (
        <FormModal title="Edit event" onClose={closeModals} wide scrollable={false}>
          {formFields}
        </FormModal>
      )}

      {deleteEvent && (
        <FormModal title="Delete event" onClose={closeModals} wide={false}>
          <div className="form-card-body">
            {error && <div className="form-error-banner mb-5">{error}</div>}
            <p className="text-slate-700">
              Are you sure you want to delete <strong>{deleteEvent.name}</strong>? This cannot be undone.
            </p>
            <div className="form-actions mt-6">
              <button type="button" onClick={closeModals} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </FormModal>
      )}
      </div>
    </>
  );
}
