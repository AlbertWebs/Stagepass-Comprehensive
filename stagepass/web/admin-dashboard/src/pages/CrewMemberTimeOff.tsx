import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type TimeOffRequestItem, type User } from '@/services/api';
import { FormModal } from '@/components/FormModal';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

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

export default function CrewMemberTimeOff() {
  const { userId } = useParams<{ userId: string }>();
  const id = userId ? parseInt(userId, 10) : NaN;
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<TimeOffRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<TimeOffRequestItem | null>(null);
  const [cancelModal, setCancelModal] = useState<TimeOffRequestItem | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id || Number.isNaN(id)) return;
    setLoading(true);
    try {
      const [u, listRes] = await Promise.all([
        api.users.get(id).catch(() => null),
        api.timeoff.list({ user_id: id, per_page: 100 }).then((r) => r.data ?? []).catch(() => []),
      ]);
      setUser(u ?? null);
      let list = Array.isArray(listRes) ? listRes : [];
      if (list.length === 0) {
        const allRes = await api.timeoff.list({ per_page: 200 }).catch(() => ({ data: [] }));
        const data = (allRes as { data?: TimeOffRequestItem[] }).data ?? [];
        list = data.filter((r) => r.user_id === id);
      }
      setRequests(list);
    } catch {
      setUser(null);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEditSaved = useCallback(() => {
    setEditModal(null);
    setError(null);
    fetchData();
  }, [fetchData]);

  const handleAddSaved = useCallback(() => {
    setAddModalOpen(false);
    setError(null);
    fetchData();
  }, [fetchData]);

  const handleCancelTimeOff = useCallback(async () => {
    if (!cancelModal) return;
    setSaving(true);
    setError(null);
    try {
      await api.timeoff.reject(cancelModal.id);
      setCancelModal(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel time off');
    } finally {
      setSaving(false);
    }
  }, [cancelModal, fetchData]);

  if (loading) {
    return <Preloader message="Loading crew member…" fullScreen />;
  }

  const validId = id && !Number.isNaN(id);
  const displayUser = user ?? requests[0]?.user ?? null;
  const displayName = displayUser?.name ?? (validId ? `Crew member #${id}` : '');
  const showNotFound = !validId;

  if (showNotFound) {
    return (
      <div className="flex max-h-[calc(100vh-6rem)] flex-col gap-6">
        <div className="flex flex-shrink-0 items-center gap-2 text-sm text-slate-600">
          <Link to="/time-off" className="hover:text-slate-900">
            Time off
          </Link>
          <span aria-hidden>/</span>
          <span className="text-slate-400">Not found</span>
        </div>
        <div className="card-elegant rounded-2xl border border-slate-200/80 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Crew member not found</h1>
          <p className="mt-2 text-slate-600">
            {validId
              ? 'This user may have been removed or you may not have access. Try opening them from the Time off crew list.'
              : 'The link may be invalid.'}
          </p>
          <Link
            to="/time-off"
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            ← Back to Time off
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-h-[calc(100vh-6rem)] flex-col gap-6 overflow-y-auto scrollbar-hide">
      <nav className="flex flex-shrink-0 items-center gap-2 text-sm text-slate-600" aria-label="Breadcrumb">
        <Link to="/time-off" className="hover:text-slate-900">
          Time off
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-slate-900">{displayName}</span>
      </nav>

      <div className="card-elegant flex flex-shrink-0 flex-wrap items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-6">
        <span
          className="inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl font-semibold text-amber-800"
          aria-hidden
        >
          {displayName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-slate-900 truncate">{displayName}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {displayUser ? [displayUser.email, displayUser.username].filter(Boolean).join(' · ') || 'Crew member' : `User #${id}`}
          </p>
        </div>
      </div>

      {error && !editModal && <div className="form-error-banner flex-shrink-0">{error}</div>}

      <SectionCard sectionLabel="Off dates">
        <p className="mb-4 px-6 text-sm text-slate-500">
          Approved entries mark this crew member as off; you can add, edit or change status below.
        </p>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/40 px-6 py-4">
          <span className="text-sm text-slate-600">
            {requests.length} entr{requests.length === 1 ? 'y' : 'ies'}
          </span>
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
        {requests.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-slate-600">No time off dates for this crew member.</p>
            <p className="mt-1 text-sm text-slate-500">Add an entry to mark them off for specific dates. Approved time off that includes today will show as &quot;You&apos;re on time off today&quot; in their mobile app.</p>
            <p className="mt-3 text-xs text-slate-400">Sent here from Check-ins (&quot;Cannot mark on&quot;)? Make sure you opened the correct employee—use &quot;Open [name]&apos;s off dates&quot; in that dialog. This page is for user ID {id}.</p>
            <button
              type="button"
              onClick={() => {
                setAddModalOpen(true);
                setError(null);
              }}
              className="btn-brand mt-4"
            >
              Add time off
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-header-brand">
              <thead>
                <tr>
                  <th className="px-6 py-4 text-left">Start</th>
                  <th className="px-6 py-4 text-left">End</th>
                  <th className="px-6 py-4 text-left">Reason</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-left">Processed</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 transition-colors hover:bg-amber-50/30">
                    <td className="px-6 py-4 text-slate-700">{formatDate(r.start_date)}</td>
                    <td className="px-6 py-4 text-slate-700">{formatDate(r.end_date)}</td>
                    <td className="max-w-[200px] truncate px-6 py-4 text-slate-600" title={r.reason ?? undefined}>
                      {r.reason || '–'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          r.status === 'approved'
                            ? 'border-green-200 bg-green-100 text-green-800'
                            : r.status === 'rejected'
                              ? 'border-red-200 bg-red-100 text-red-800'
                              : 'border-slate-200 bg-slate-100 text-slate-700'
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
                      <span className="inline-flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setEditModal(r);
                            setError(null);
                          }}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-50/50 hover:text-amber-800 disabled:opacity-50"
                        >
                          Edit
                          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {r.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelModal(r);
                              setError(null);
                            }}
                            disabled={saving}
                            className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
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
        )}
      </SectionCard>

      {editModal && (
        <EditTimeOffModal
          request={editModal}
          onClose={() => setEditModal(null)}
          onSaved={handleEditSaved}
          saving={saving}
          setSaving={setSaving}
          error={error}
          setError={setError}
        />
      )}

      {cancelModal && (
        <FormModal title="Cancel time off" onClose={() => setCancelModal(null)} wide={false}>
          <div className="px-6 py-4">
            {error && <div className="form-error-banner mb-4">{error}</div>}
            <p className="text-slate-700">
              Cancel this approved time off ({formatDate(cancelModal.start_date)} – {formatDate(cancelModal.end_date)})? The employee will be marked <strong>on</strong> for these dates on Check-ins.
            </p>
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => setCancelModal(null)} className="btn-secondary">
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleCancelTimeOff}
                disabled={saving}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Cancelling…' : 'Cancel time off'}
              </button>
            </div>
          </div>
        </FormModal>
      )}

      {addModalOpen && (
        <AddTimeOffModal
          userId={id}
          userName={displayName}
          onClose={() => setAddModalOpen(false)}
          onSaved={handleAddSaved}
          saving={saving}
          setSaving={setSaving}
          error={error}
          setError={setError}
        />
      )}
    </div>
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
      await api.timeoff.update(request.id, {
        start_date,
        end_date,
        reason: reason || undefined,
        notes: notes || undefined,
        status,
      });
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
        <p className="mb-4 text-xs text-slate-500">
          Multi-day block? Change start or end date to exclude a day. Or set Status to <strong>Rejected</strong> to cancel this time off entirely.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-field">
            <label className="form-label" htmlFor="edit-start">
              Start date
            </label>
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
            <label className="form-label" htmlFor="edit-end">
              End date
            </label>
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
          <label className="form-label" htmlFor="edit-reason">
            Reason (optional)
          </label>
          <input
            id="edit-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="form-input"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="edit-notes">
            Notes (optional)
          </label>
          <textarea
            id="edit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="form-input min-h-[80px]"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="edit-status">
            Status
          </label>
          <select
            id="edit-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'pending' | 'approved' | 'rejected')}
            className="form-select"
          >
            {STATUS_OPTIONS_FORM.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}

function AddTimeOffModal({
  userId,
  userName,
  onClose,
  onSaved,
  saving,
  setSaving,
  error,
  setError,
}: {
  userId: number;
  userName: string;
  onClose: () => void;
  onSaved: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
}) {
  const [start_date, setStart_date] = useState(toDateInput(new Date().toISOString().slice(0, 10)));
  const [end_date, setEnd_date] = useState(toDateInput(new Date().toISOString().slice(0, 10)));
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('approved');

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
      await api.timeoff.create({
        user_id: userId,
        start_date,
        end_date,
        reason: reason || undefined,
        notes: notes || undefined,
        status,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add time off');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal title={`Add time off – ${userName}`} onClose={onClose} wide={false}>
      <form onSubmit={handleSubmit} className="px-6 py-4">
        {error && <div className="form-error-banner mb-4">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div className="form-field">
            <label className="form-label" htmlFor="add-start">
              Start date
            </label>
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
            <label className="form-label" htmlFor="add-end">
              End date
            </label>
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
          <label className="form-label" htmlFor="add-reason">
            Reason (optional)
          </label>
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
          <label className="form-label" htmlFor="add-notes">
            Notes (optional)
          </label>
          <textarea
            id="add-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="form-input min-h-[80px]"
            placeholder="Internal notes"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="add-status">
            Status
          </label>
          <select
            id="add-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'pending' | 'approved' | 'rejected')}
            className="form-select"
          >
            {STATUS_OPTIONS_FORM.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50">
            {saving ? 'Saving…' : 'Add time off'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
