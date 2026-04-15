import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type Event,
  type Paginated,
  type TaskItem,
  type TaskPriority,
  type TaskStatus,
  type User,
} from '@/services/api';
import { FormModal } from '@/components/FormModal';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
];

type TaskFormState = {
  title: string;
  description: string;
  event_id: string;
  priority: TaskPriority;
  due_date: string;
  notes: string;
  assignee_ids: number[];
};

function emptyForm(): TaskFormState {
  return {
    title: '',
    description: '',
    event_id: '',
    priority: 'medium',
    due_date: '',
    notes: '',
    assignee_ids: [],
  };
}

function taskToForm(t: TaskItem): TaskFormState {
  return {
    title: t.title,
    description: t.description ?? '',
    event_id: t.event_id ? String(t.event_id) : '',
    priority: t.priority,
    due_date: t.due_date ? t.due_date.slice(0, 10) : '',
    notes: t.notes ?? '',
    assignee_ids: t.assignees?.map((a) => a.id) ?? [],
  };
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
}

export default function Tasks() {
  const [data, setData] = useState<Paginated<TaskItem> | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filterEventId, setFilterEventId] = useState<string>('');
  const [filterUserId, setFilterUserId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<TaskItem | null>(null);
  const [detailTask, setDetailTask] = useState<TaskItem | null>(null);
  const [deleteTask, setDeleteTask] = useState<TaskItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<TaskFormState>(emptyForm());
  const [pageLoading, setPageLoading] = useState(true);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  const fetchTasks = useCallback(() => {
    setPageLoading(true);
    api.tasks
      .list({
        event_id: filterEventId ? Number(filterEventId) : undefined,
        user_id: filterUserId ? Number(filterUserId) : undefined,
        status: filterStatus || undefined,
        search: search.trim() || undefined,
        page,
        per_page: 20,
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setPageLoading(false));
  }, [filterEventId, filterUserId, filterStatus, search, page]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    api.events.list({ per_page: 500 }).then((r) => setEvents(r.data ?? [])).catch(() => setEvents([]));
    api.users.list({ per_page: 500 }).then((r) => setUsers(r.data ?? [])).catch(() => setUsers([]));
  }, []);

  const tasks = data?.data ?? [];

  const openCreate = () => {
    setForm(emptyForm());
    setError(null);
    setAssigneeSearch('');
    setCreateOpen(true);
  };

  const openEdit = (t: TaskItem) => {
    setForm(taskToForm(t));
    setError(null);
    setAssigneeSearch('');
    setEditTask(t);
  };

  const openDetail = (t: TaskItem) => {
    setDetailTask(t);
  };

  const closeModals = () => {
    setCreateOpen(false);
    setEditTask(null);
    setDetailTask(null);
    setDeleteTask(null);
    setError(null);
  };

  const toggleAssignee = (userId: number) => {
    setForm((f) => ({
      ...f,
      assignee_ids: f.assignee_ids.includes(userId)
        ? f.assignee_ids.filter((id) => id !== userId)
        : [...f.assignee_ids, userId],
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.tasks.create({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        event_id: form.event_id ? Number(form.event_id) : undefined,
        priority: form.priority,
        due_date: form.due_date || undefined,
        notes: form.notes.trim() || undefined,
        assignee_ids: form.assignee_ids.length ? form.assignee_ids : undefined,
      });
      closeModals();
      fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTask) return;
    setSaving(true);
    setError(null);
    try {
      await api.tasks.update(editTask.id, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        event_id: form.event_id ? Number(form.event_id) : undefined,
        priority: form.priority,
        due_date: form.due_date || undefined,
        notes: form.notes.trim() || undefined,
        assignee_ids: form.assignee_ids,
      });
      closeModals();
      fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTask) return;
    setSaving(true);
    setError(null);
    try {
      await api.tasks.delete(deleteTask.id);
      closeModals();
      fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    } finally {
      setSaving(false);
    }
  };

  const formContent = (
    <div className="form-card-body">
      {error && <div className="form-error-banner mb-5">{error}</div>}
      <form onSubmit={editTask ? handleUpdate : handleCreate} className="space-y-5">
        <div className="form-row-single">
          <label className="form-label" htmlFor="task-title">Title *</label>
          <input
            id="task-title"
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="form-input"
            placeholder="Task title"
          />
        </div>
        <div className="form-row-single">
          <label className="form-label form-label-optional" htmlFor="task-desc">Description</label>
          <textarea
            id="task-desc"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="form-input min-h-[80px]"
            placeholder="Optional description"
            rows={3}
          />
        </div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label form-label-optional" htmlFor="task-event">Event</label>
            <select
              id="task-event"
              value={form.event_id}
              onChange={(e) => setForm((f) => ({ ...f, event_id: e.target.value }))}
              className="form-select"
            >
              <option value="">— None —</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.date})
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="task-priority">Priority</label>
            <select
              id="task-priority"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
              className="form-select"
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label form-label-optional" htmlFor="task-due">Due date</label>
            <input
              id="task-due"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              className="form-input"
            />
          </div>
        </div>
        <div className="form-row-single">
          <label className="form-label form-label-optional" id="task-assignees-label">
            Assign to (select one or more)
          </label>
          <p className="text-xs text-slate-500 mt-0.5 mb-2">
            Choose who this task is assigned to. They will see it in the mobile app.
          </p>
          {users.length === 0 ? (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No users loaded. Add users in User &amp; crew to assign tasks.
            </p>
          ) : (
            <>
              <input
                type="search"
                value={assigneeSearch}
                onChange={(e) => setAssigneeSearch(e.target.value)}
                placeholder="Search by name…"
                className="form-input mb-2 w-full max-w-xs"
                aria-describedby="task-assignees-label"
              />
              <div
                className="border border-slate-200 rounded-lg bg-slate-50/50 max-h-48 overflow-y-auto p-2 space-y-1"
                role="group"
                aria-labelledby="task-assignees-label"
              >
                {users
                  .filter((u) => !assigneeSearch.trim() || u.name.toLowerCase().includes(assigneeSearch.trim().toLowerCase()))
                  .map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2.5 cursor-pointer rounded-md px-2 py-1.5 hover:bg-white hover:shadow-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.assignee_ids.includes(u.id)}
                        onChange={() => toggleAssignee(u.id)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-700">{u.name}</span>
                      {u.email && (
                        <span className="text-xs text-slate-400 truncate ml-auto">{u.email}</span>
                      )}
                    </label>
                  ))}
                {users.filter((u) => !assigneeSearch.trim() || u.name.toLowerCase().includes(assigneeSearch.trim().toLowerCase())).length === 0 && (
                  <p className="text-sm text-slate-500 px-2 py-2">No matching users</p>
                )}
              </div>
              {form.assignee_ids.length > 0 && (
                <p className="text-xs text-slate-600 mt-1.5">
                  {form.assignee_ids.length} selected
                </p>
              )}
            </>
          )}
        </div>
        <div className="form-row-single">
          <label className="form-label form-label-optional" htmlFor="task-notes">Notes / instructions</label>
          <textarea
            id="task-notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="form-input min-h-[60px]"
            placeholder="Optional notes or instructions"
            rows={2}
          />
        </div>
        <div className="form-actions">
          <button type="button" onClick={closeModals} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50">
            {saving ? 'Saving…' : editTask ? 'Update task' : 'Create task'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Task Management"
        subtitle="Create and assign tasks to crew. Tasks sync with the mobile app."
        action={
          <button
            type="button"
            onClick={openCreate}
            className="btn-brand inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium shadow-sm"
          >
            <span aria-hidden>+</span>
            Create task
          </button>
        }
      />
      <SectionCard className="p-5 sm:p-6 lg:p-7">
        <h2 className="text-base font-semibold text-slate-800">Tasks</h2>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-2">
            <label htmlFor="tasks-search" className="mb-1 block text-xs font-medium text-slate-500">
              Search
            </label>
            <input
              id="tasks-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="form-input w-full"
            />
          </div>
          <div>
            <label htmlFor="tasks-event" className="mb-1 block text-xs font-medium text-slate-500">
              Event
            </label>
            <select
              id="tasks-event"
              value={filterEventId}
              onChange={(e) => setFilterEventId(e.target.value)}
              className="form-select w-full"
            >
              <option value="">All events</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tasks-crew" className="mb-1 block text-xs font-medium text-slate-500">
              Crew
            </label>
            <select
              id="tasks-crew"
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="form-select w-full"
            >
              <option value="">All crew</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tasks-status" className="mb-1 block text-xs font-medium text-slate-500">
              Status
            </label>
            <select
              id="tasks-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="form-select w-full"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {pageLoading && !data ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div
              className="h-10 w-10 rounded-full border-2 border-brand-200 border-t-brand-600"
              style={{ animation: 'preloader-spin 0.9s linear infinite' }}
              aria-hidden
            />
            <p className="mt-4 text-sm text-slate-500">Loading tasks…</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
            <p className="text-slate-600">No tasks match your filters.</p>
            <p className="mt-1 text-sm text-slate-500">Create a task to get started.</p>
            <button
              type="button"
              onClick={openCreate}
              className="btn-brand mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium"
            >
              <span aria-hidden>+</span>
              Create task
            </button>
          </div>
        ) : (
          <div className="mt-7 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="text-left py-4 px-5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Title
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Event
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Assigned
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Priority
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Status
                  </th>
                  <th className="text-left py-4 px-5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Due
                  </th>
                  <th className="text-right py-4 px-5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((t) => (
                  <tr key={t.id} className="bg-white transition-colors hover:bg-slate-50/80">
                    <td className="py-4 px-5">
                      <button
                        type="button"
                        onClick={() => openDetail(t)}
                        className="text-left font-medium text-brand-600 hover:text-brand-700 hover:underline"
                      >
                        {t.title}
                      </button>
                    </td>
                    <td className="py-4 px-5 text-sm text-slate-600">{t.event?.name ?? '—'}</td>
                    <td className="py-4 px-5 text-sm text-slate-600">
                      {t.assignees?.length ? t.assignees.map((a) => a.name).join(', ') : '—'}
                    </td>
                    <td className="py-4 px-5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          t.priority === 'high'
                            ? 'bg-red-100 text-red-800'
                            : t.priority === 'medium'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {PRIORITY_OPTIONS.find((o) => o.value === t.priority)?.label ?? t.priority}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          t.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.status === 'in_progress'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {STATUS_OPTIONS.find((o) => o.value === t.status)?.label ?? t.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-sm text-slate-600">{formatDate(t.due_date)}</td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTask(t)}
                          className="text-sm font-medium text-red-600 hover:text-red-700 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.last_page > 1 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4">
            <span className="text-sm text-slate-600">
              Page {data.current_page} of {data.last_page} · {data.total} task{data.total !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={data.current_page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-secondary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={data.current_page >= data.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      <FormModal
        open={createOpen || !!editTask}
        onClose={closeModals}
        title={editTask ? 'Edit task' : 'Create task'}
      >
        {formContent}
      </FormModal>

      {detailTask && (
        <FormModal open onClose={() => setDetailTask(null)} title={detailTask.title}>
          <div className="form-card-body space-y-4">
            {detailTask.description && (
              <p className="text-gray-700 whitespace-pre-wrap">{detailTask.description}</p>
            )}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500">Event</dt>
              <dd>{detailTask.event?.name ?? '—'}</dd>
              <dt className="text-gray-500">Priority</dt>
              <dd>{PRIORITY_OPTIONS.find((o) => o.value === detailTask.priority)?.label ?? detailTask.priority}</dd>
              <dt className="text-gray-500">Status</dt>
              <dd>{STATUS_OPTIONS.find((o) => o.value === detailTask.status)?.label ?? detailTask.status}</dd>
              <dt className="text-gray-500">Due date</dt>
              <dd>{formatDate(detailTask.due_date)}</dd>
              <dt className="text-gray-500">Assigned</dt>
              <dd>{detailTask.assignees?.length ? detailTask.assignees.map((a) => a.name).join(', ') : '—'}</dd>
            </dl>
            {detailTask.notes && (
              <>
                <dt className="text-gray-500 text-sm">Notes</dt>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{detailTask.notes}</p>
              </>
            )}
            <div className="pt-4">
              <button type="button" onClick={() => { setDetailTask(null); openEdit(detailTask); }} className="btn-brand">
                Edit task
              </button>
            </div>
          </div>
        </FormModal>
      )}

      {deleteTask && (
        <FormModal open onClose={() => setDeleteTask(null)} title="Delete task">
          <div className="form-card-body">
            {error && <div className="form-error-banner mb-5">{error}</div>}
            <p className="text-gray-700 mb-6">
              Delete &quot;{deleteTask.title}&quot;? This cannot be undone.
            </p>
            <div className="form-actions">
              <button type="button" onClick={() => setDeleteTask(null)} className="btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={saving} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </FormModal>
      )}
    </>
  );
}
