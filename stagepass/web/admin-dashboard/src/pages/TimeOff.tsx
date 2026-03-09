import { useCallback, useEffect, useState } from 'react';
import { api, type Paginated, type TimeOffRequestItem } from '@/services/api';
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

function formatDate(d: string) {
  try {
    const [y, m, day] = d.split('-');
    const date = new Date(Number(y), Number(m) - 1, Number(day));
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

export default function TimeOff() {
  const [data, setData] = useState<Paginated<TimeOffRequestItem> | null>(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<TimeOffRequestItem | null>(null);
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

  const requests = data?.data ?? [];

  if (pageLoading && !data) {
    return <Preloader message="Loading time off…" fullScreen />;
  }

  const closeModals = () => {
    setRejectModal(null);
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
        subtitle="View time off requests from crew and approve or reject them. Requests are submitted via the mobile app."
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
      </div>

      {error && !rejectModal && (
        <div className="form-error-banner flex-shrink-0">{error}</div>
      )}

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
                    {r.status === 'pending' && (
                      <span className="inline-flex gap-3">
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
                      </span>
                    )}
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
        <FormModal title="Reject time off" onClose={closeModals} wide={false}>
          <div className="px-6 py-4">
            {error && <div className="form-error-banner mb-4">{error}</div>}
            <p className="text-slate-700">
              Reject time off for <strong>{rejectModal.user?.name ?? `User #${rejectModal.user_id}`}</strong> ({formatDate(rejectModal.start_date)} – {formatDate(rejectModal.end_date)})?
            </p>
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={closeModals} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={saving}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
}
