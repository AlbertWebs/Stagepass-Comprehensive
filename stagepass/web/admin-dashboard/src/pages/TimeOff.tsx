import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Paginated, type TimeOffRequestItem, type User } from '@/services/api';
import { FormModal } from '@/components/FormModal';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_OPTIONS_FORM = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function formatDate(d: string) {
  try {
    const [y, m, day] = d.split('-');
    const date = new Date(Number(y), Number(m) - 1, Number(day));
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

function toDateInput(d: string): string {
  if (!d || d.length < 10) return '';
  return d.slice(0, 10);
}

export default function TimeOff() {
  const [data, setData] = useState<Paginated<TimeOffRequestItem> | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [crewSearch, setCrewSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<TimeOffRequestItem | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModal, setEditModal] = useState<TimeOffRequestItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(() => {
    setPageLoading(true);
    api.timeoff
      .list({
        status: status || undefined,
        page,
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setPageLoading(false));
  }, [status, page]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    setUsersLoading(true);
    setUsersError(null);
    api.users
      .list({ per_page: 500 })
      .then((r) => {
        setUsers(r.data ?? []);
        setUsersError(null);
      })
      .catch((err) => {
        setUsers([]);
        setUsersError(err instanceof Error ? err.message : 'Failed to load crew members');
      })
      .finally(() => setUsersLoading(false));
  }, []);

  const requests = data?.data ?? [];

  const crewFiltered = crewSearch.trim()
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(crewSearch.trim().toLowerCase()) ||
          (u.email?.toLowerCase().includes(crewSearch.trim().toLowerCase()) ?? false) ||
          (u.username?.toLowerCase().includes(crewSearch.trim().toLowerCase()) ?? false)
      )
    : users;

  if (pageLoading && !data) {
    return <Preloader message="Loading time off…" fullScreen />;
  }

  const closeModals = () => {
    setRejectModal(null);
    setAddModalOpen(false);
    setEditModal(null);
    setError(null);
  };

  const handleApprove = async (item: TimeOffRequestItem) => {
    setSaving(true);
    setError(null);
    try {
      await api.timeoff.approve(item.id);
      closeModals();
      fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setSaving(true);
    setError(null);
    try {
      await api.timeoff.reject(rejectModal.id);
      closeModals();
      fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-h-[calc(100vh-6rem)] flex-col gap-6 overflow-y-auto scrollbar-hide">
      <PageHeader
        title="Time off"
        subtitle="Add or edit time off for crew, and approve or reject requests submitted via the mobile app."
      />

      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <span className="text-sm font-medium text-slate-600">Filters</span>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="form-select w-auto min-w-[10rem]"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setAddModalOpen(true);
            setError(null);
          }}
          className="btn-brand"
        >
          Add time off
        </button>
      </div>

      {error && !rejectModal && (
        <div className="form-error-banner flex-shrink-0">{error}</div>
      )}

      {usersError && (
        <div className="form-error-banner flex-shrink-0">
          {usersError} The employee dropdown in &quot;Add time off&quot; may be empty.
        </div>
      )}

      <SectionCard sectionLabel="Crew members">
        <p className="mb-4 px-6 pt-6 text-sm text-slate-500">
          Search and manage time off per crew member. Open a crew member to view or edit their off dates.
        </p>
        {usersLoading ? (
          <div className="px-6 py-10 text-center text-slate-500">Loading crew members…</div>
        ) : users.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-slate-600">No crew members found.</p>
            <p className="mt-1 text-sm text-slate-500">
              Add users under <Link to="/users" className="text-brand-600 hover:underline">Users</Link> or{' '}
              <Link to="/crew" className="text-brand-600 hover:underline">Crew</Link> to assign time off.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/80 bg-slate-50/40 px-6 py-4">
              <label htmlFor="crew-search" className="sr-only">
                Search crew by name, email or username
              </label>
              <input
                id="crew-search"
                type="search"
                value={crewSearch}
                onChange={(e) => setCrewSearch(e.target.value)}
                placeholder="Search by name, email or username…"
                className="form-input max-w-xs flex-1 min-w-[200px] rounded-lg py-2"
                aria-label="Search crew"
              />
              <span className="text-sm text-slate-500">
                {crewFiltered.length === users.length
                  ? `${users.length} crew member${users.length === 1 ? '' : 's'}`
                  : `${crewFiltered.length} of ${users.length} shown`}
              </span>
            </div>
            {crewFiltered.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-500">
                No crew members match &quot;{crewSearch.trim()}&quot;. Try a different search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-header-brand">
                  <thead>
                    <tr>
                      <th className="w-0 whitespace-nowrap px-6 py-4"></th>
                      <th className="px-6 py-4 text-left">Name</th>
                      <th className="px-6 py-4 text-left">Email</th>
                      <th className="px-6 py-4 text-left">Username</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crewFiltered.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-slate-100 transition-colors hover:bg-amber-50/30"
                      >
                        <td className="w-0 whitespace-nowrap px-6 py-3">
                          <span
                            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-800"
                            aria-hidden
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className="font-medium text-slate-900">{u.name}</span>
                        </td>
                        <td className="px-6 py-3 text-slate-600">{u.email || '–'}</td>
                        <td className="px-6 py-3 text-slate-600">{u.username || '–'}</td>
                        <td className="px-6 py-3 text-right">
                          <Link
                            to={`/time-off/crew/${u.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-50/50 hover:text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                          >
                            Manage off dates
                            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard sectionLabel="Time off requests">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full table-header-brand">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Start</th>
                <th>End</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Processed</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                  <td className="px-6 py-4">
                    <span className="font-medium text-slate-900">
                      {r.user?.name ?? `User #${r.user_id}`}
                    </span>
                    {r.user?.email && (
                      <span className="block text-sm text-slate-500">{r.user.email}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-700">{formatDate(r.start_date)}</td>
                  <td className="px-6 py-4 text-slate-700">{formatDate(r.end_date)}</td>
                  <td className="max-w-[200px] truncate px-6 py-4 text-slate-600" title={r.reason ?? undefined}>
                    {r.reason || '–'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`chip-brand capitalize ${
                        r.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : r.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : ''
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {r.processed_at
                      ? `${r.processedBy?.name ?? 'Someone'} · ${new Date(r.processed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : '–'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex flex-wrap items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setEditModal(r);
                          setError(null);
                        }}
                        disabled={saving}
                        className="text-sm font-medium text-slate-700 hover:text-brand-600 hover:underline"
                        title="Change dates, reason or status"
                      >
                        Edit dates
                      </button>
                      {r.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApprove(r)}
                            disabled={saving}
                            className="link-brand text-green-700 font-medium"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectModal(r);
                              setError(null);
                            }}
                            disabled={saving}
                            className="text-sm font-medium text-red-600 hover:underline"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {r.status === 'approved' && (
                        <button
                          type="button"
                          onClick={() => {
                            setRejectModal(r);
                            setError(null);
                          }}
                          disabled={saving}
                          className="text-sm font-medium text-red-600 hover:underline"
                          title="Cancel this time off (employee will be marked on for these dates)"
                        >
                          Cancel time off
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!requests.length && (
          <div className="px-6 py-14 text-center text-slate-600">
            No time off requests found. Crew submit requests via the mobile app.
          </div>
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
      </SectionCard>

      {rejectModal && (
        <FormModal
          title={rejectModal.status === 'approved' ? 'Cancel time off' : 'Reject time off'}
          onClose={closeModals}
          wide={false}
        >
          <div className="px-6 py-4">
            {error && <div className="form-error-banner mb-4">{error}</div>}
            <p className="text-slate-700">
              {rejectModal.status === 'approved' ? (
                <>Cancel the approved time off for <strong>{rejectModal.user?.name ?? `User #${rejectModal.user_id}`}</strong> ({formatDate(rejectModal.start_date)} – {formatDate(rejectModal.end_date)})? They will be marked <strong>on</strong> for these dates on Check-ins.</>
              ) : (
                <>Reject time off for <strong>{rejectModal.user?.name ?? `User #${rejectModal.user_id}`}</strong> ({formatDate(rejectModal.start_date)} – {formatDate(rejectModal.end_date)})?</>
              )}
            </p>
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={closeModals} className="btn-secondary">
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={saving}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? (rejectModal.status === 'approved' ? 'Cancelling…' : 'Rejecting…') : rejectModal.status === 'approved' ? 'Cancel time off' : 'Reject'}
              </button>
            </div>
          </div>
        </FormModal>
      )}

      {addModalOpen && (
        <AddTimeOffModal
          users={users}
          onClose={closeModals}
          onSaved={() => {
            closeModals();
            fetchRequests();
          }}
          saving={saving}
          setSaving={setSaving}
          error={error}
          setError={setError}
        />
      )}

      {editModal && (
        <EditTimeOffModal
          request={editModal}
          onClose={closeModals}
          onSaved={() => {
            closeModals();
            fetchRequests();
          }}
          saving={saving}
          setSaving={setSaving}
          error={error}
          setError={setError}
        />
      )}
    </div>
  );
}

function AddTimeOffModal({
  users,
  onClose,
  onSaved,
  saving,
  setSaving,
  error,
  setError,
}: {
  users: User[];
  onClose: () => void;
  onSaved: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
}) {
  const [user_id, setUser_id] = useState<number | ''>(users[0]?.id ?? '');
  const [start_date, setStart_date] = useState(toDateInput(new Date().toISOString().slice(0, 10)));
  const [end_date, setEnd_date] = useState(toDateInput(new Date().toISOString().slice(0, 10)));
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('approved');

  useEffect(() => {
    if (users.length && (user_id === '' || user_id === 0)) setUser_id(users[0].id);
  }, [users, user_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = user_id === '' ? 0 : Number(user_id);
    if (!uid || !start_date || !end_date) {
      setError('Select an employee and both dates.');
      return;
    }
    if (end_date < start_date) {
      setError('End date must be on or after start date.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.timeoff.create({ user_id: uid, start_date, end_date, reason: reason || undefined, notes: notes || undefined, status });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add time off');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal title="Add time off" onClose={onClose} wide={false}>
      <form onSubmit={handleSubmit} className="px-6 py-4">
        {error && <div className="form-error-banner mb-4">{error}</div>}
        <div className="form-field">
          <label className="form-label" htmlFor="add-user">
            Employee
          </label>
          <select
            id="add-user"
            value={user_id === '' ? '' : user_id}
            onChange={(e) => setUser_id(e.target.value === '' ? '' : Number(e.target.value))}
            className="form-select"
            required
          >
            <option value="">Select employee</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.email ? ` (${u.email})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-field">
            <label className="form-label" htmlFor="add-start">Start date</label>
            <input
              id="add-start"
              type="date"
              value={start_date}
              onChange={(e) => setStart_date(e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="add-end">End date</label>
            <input
              id="add-end"
              type="date"
              value={end_date}
              onChange={(e) => setEnd_date(e.target.value)}
              className="form-input"
              required
            />
          </div>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="add-reason">Reason (optional)</label>
          <input
            id="add-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="form-input"
            placeholder="e.g. Leave, Sick"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="add-notes">Notes (optional)</label>
          <textarea
            id="add-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="form-input min-h-[80px]"
            placeholder="Internal notes"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="add-status">Status</label>
          <select
            id="add-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'pending' | 'approved' | 'rejected')}
            className="form-select"
          >
            {STATUS_OPTIONS_FORM.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50">
            {saving ? 'Saving…' : 'Add time off'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}

function EditTimeOffModal({
  request,
  onClose,
  onSaved,
  saving,
  setSaving,
  error,
  setError,
}: {
  request: TimeOffRequestItem;
  onClose: () => void;
  onSaved: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
}) {
  const [start_date, setStart_date] = useState(toDateInput(request.start_date));
  const [end_date, setEnd_date] = useState(toDateInput(request.end_date));
  const [reason, setReason] = useState(request.reason ?? '');
  const [notes, setNotes] = useState(request.notes ?? '');
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>(request.status);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!start_date || !end_date) {
      setError('Start and end date are required.');
      return;
    }
    if (end_date < start_date) {
      setError('End date must be on or after start date.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.timeoff.update(request.id, { start_date, end_date, reason: reason || undefined, notes: notes || undefined, status });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update time off');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal title="Edit time off" onClose={onClose} wide={false}>
      <form onSubmit={handleSubmit} className="px-6 py-4">
        {error && <div className="form-error-banner mb-4">{error}</div>}
        <p className="mb-2 text-sm text-slate-600">
          Employee: <strong>{request.user?.name ?? `User #${request.user_id}`}</strong>
        </p>
        <p className="mb-4 text-xs text-slate-500">
          Multi-day block? Change start or end date to exclude a day. Or set Status to <strong>Rejected</strong> to cancel this time off entirely.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-field">
            <label className="form-label" htmlFor="edit-start">Start date</label>
            <input
              id="edit-start"
              type="date"
              value={start_date}
              onChange={(e) => setStart_date(e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="edit-end">End date</label>
            <input
              id="edit-end"
              type="date"
              value={end_date}
              onChange={(e) => setEnd_date(e.target.value)}
              className="form-input"
              required
            />
          </div>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="edit-reason">Reason (optional)</label>
          <input
            id="edit-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="form-input"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="edit-notes">Notes (optional)</label>
          <textarea
            id="edit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="form-input min-h-[80px]"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="edit-status">Status</label>
          <select
            id="edit-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'pending' | 'approved' | 'rejected')}
            className="form-select"
          >
            {STATUS_OPTIONS_FORM.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
