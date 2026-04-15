import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Paginated, type PaymentItem, type TimeOffRequestItem } from '@/services/api';
import { FormModal } from '@/components/FormModal';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

/** Format date string (YYYY-MM-DD or ISO) to e.g. "12 Mar 2025" */
function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dateOnly = typeof d === 'string' && d.length >= 10 ? d.slice(0, 10) : String(d).slice(0, 10);
  const parts = dateOnly.split('-');
  if (parts.length !== 3) return d;
  try {
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateOnly;
  }
}

export default function Approvals() {
  const [timeOffData, setTimeOffData] = useState<Paginated<TimeOffRequestItem> | null>(null);
  const [paymentsData, setPaymentsData] = useState<Paginated<PaymentItem> | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeType, setActiveType] = useState<'all' | 'timeoff' | 'payment'>('all');
  const [query, setQuery] = useState('');
  const [rejectTarget, setRejectTarget] = useState<
    | { type: 'timeoff'; item: TimeOffRequestItem }
    | { type: 'payment'; item: PaymentItem }
    | null
  >(null);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const fetchAll = useCallback(() => {
    setPageLoading(true);
    Promise.all([
      api.timeoff.list({ status: 'pending' }),
      api.payments.list({ status: 'pending' }),
    ])
      .then(([to, pay]) => {
        setTimeOffData(to);
        setPaymentsData(pay);
      })
      .catch(() => {
        setTimeOffData(null);
        setPaymentsData(null);
      })
      .finally(() => setPageLoading(false));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (pageLoading && !timeOffData && !paymentsData) {
    return <Preloader message="Loading approvals…" fullScreen />;
  }

  const pendingTimeOff = timeOffData?.data ?? [];
  const pendingPayments = paymentsData?.data ?? [];

  const queue = useMemo(() => {
    const rows = [
      ...pendingTimeOff.map((r) => ({
        key: `timeoff-${r.id}`,
        type: 'timeoff' as const,
        id: r.id,
        person: r.user?.name ?? '—',
        eventOrPeriod: `${formatDate(r.start_date)} → ${formatDate(r.end_date)}`,
        detail: r.reason ?? 'No reason provided',
        amountOrDays: `${r.start_date === r.end_date ? '1 day' : 'Multiple days'}`,
        createdAt: r.created_at,
        raw: r,
      })),
      ...pendingPayments.map((p) => ({
        key: `payment-${p.id}`,
        type: 'payment' as const,
        id: p.id,
        person: p.user?.name ?? '—',
        eventOrPeriod: p.event?.name ?? `Event #${p.event_id}`,
        detail: p.purpose ?? 'General payment',
        amountOrDays: `KES ${Number(p.total_amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
        createdAt: p.created_at,
        raw: p,
      })),
    ];
    const q = query.trim().toLowerCase();
    return rows
      .filter((row) => (activeType === 'all' ? true : row.type === activeType))
      .filter((row) =>
        !q
          ? true
          : `${row.person} ${row.eventOrPeriod} ${row.detail} ${row.amountOrDays}`
              .toLowerCase()
              .includes(q)
      )
      .sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return at - bt;
      });
  }, [pendingPayments, pendingTimeOff, activeType, query]);

  const selectedRows = queue.filter((row) => selectedKeys.includes(row.key));
  const allVisibleSelected = queue.length > 0 && queue.every((row) => selectedKeys.includes(row.key));

  const handleApproveTimeOff = async (item: TimeOffRequestItem) => {
    setSaving(true);
    setError(null);
    try {
      await api.timeoff.approve(item.id);
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setSaving(false);
    }
  };

  const handleRejectTimeOff = async () => {
    if (!rejectTarget || rejectTarget.type !== 'timeoff') return;
    setSaving(true);
    setError(null);
    try {
      await api.timeoff.reject(rejectTarget.item.id);
      setRejectTarget(null);
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setSaving(false);
    }
  };

  const handleApprovePayment = async (item: PaymentItem) => {
    setSaving(true);
    setError(null);
    try {
      await api.payments.approve(item.id);
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setSaving(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectTarget || rejectTarget.type !== 'payment') return;
    setSaving(true);
    setError(null);
    try {
      await api.payments.reject(rejectTarget.item.id, rejectReason.trim() || undefined);
      setRejectTarget(null);
      setRejectReason('');
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkApprove = async () => {
    if (!selectedRows.length) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        selectedRows.map((row) =>
          row.type === 'timeoff'
            ? api.timeoff.approve((row.raw as TimeOffRequestItem).id)
            : api.payments.approve((row.raw as PaymentItem).id)
        )
      );
      setSelectedKeys([]);
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve selected items');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedKeys((prev) => prev.filter((k) => !queue.some((r) => r.key === k)));
      return;
    }
    setSelectedKeys((prev) => Array.from(new Set([...prev, ...queue.map((r) => r.key)])));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        subtitle="One practical queue for pending time off and payment approvals."
      />

      {error && <div className="form-error-banner">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Total pending</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{pendingTimeOff.length + pendingPayments.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Time off</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{pendingTimeOff.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Payments</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{pendingPayments.length}</p>
        </div>
      </div>

      <SectionCard sectionLabel="Approval queue">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-6 py-4">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'timeoff', label: 'Time off' },
              { id: 'payment', label: 'Payments' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setActiveType(opt.id as typeof activeType)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  activeType === opt.id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search person, event, reason…"
            className="form-input min-w-[220px] max-w-md"
          />
          <button type="button" onClick={fetchAll} className="btn-secondary" disabled={saving}>
            Refresh
          </button>
          <button
            type="button"
            onClick={handleBulkApprove}
            className="btn-brand"
            disabled={saving || selectedRows.length === 0}
          >
            {saving ? 'Approving…' : `Approve selected (${selectedRows.length})`}
          </button>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          {queue.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              No pending approvals for the selected filter.
            </div>
          ) : (
            <table className="w-full table-header-brand">
              <thead>
                <tr>
                  <th className="w-[52px]">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all visible approvals"
                    />
                  </th>
                  <th>Type</th>
                  <th>Person</th>
                  <th>Event / Period</th>
                  <th>Details</th>
                  <th>Amount / Days</th>
                  <th>Submitted</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((row) => (
                  <tr key={row.key} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedKeys.includes(row.key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedKeys((prev) => Array.from(new Set([...prev, row.key])));
                          } else {
                            setSelectedKeys((prev) => prev.filter((k) => k !== row.key));
                          }
                        }}
                        aria-label={`Select ${row.type} ${row.id}`}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${row.type === 'timeoff' ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'}`}>
                        {row.type === 'timeoff' ? 'Time Off' : 'Payment'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">{row.person}</td>
                    <td className="px-6 py-4 text-slate-600">{row.eventOrPeriod}</td>
                    <td className="px-6 py-4 text-slate-600">{row.detail}</td>
                    <td className="px-6 py-4 text-slate-600">{row.amountOrDays}</td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(row.createdAt ?? null)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            row.type === 'timeoff'
                              ? handleApproveTimeOff(row.raw as TimeOffRequestItem)
                              : handleApprovePayment(row.raw as PaymentItem)
                          }
                          disabled={saving}
                          className="link-brand disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectReason('');
                            setRejectTarget(
                              row.type === 'timeoff'
                                ? { type: 'timeoff', item: row.raw as TimeOffRequestItem }
                                : { type: 'payment', item: row.raw as PaymentItem }
                            );
                          }}
                          disabled={saving}
                          className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SectionCard>

      {rejectTarget && (
        <FormModal
          title={rejectTarget.type === 'timeoff' ? 'Reject time off request' : 'Reject payment request'}
          onClose={() => setRejectTarget(null)}
          wide={false}
        >
          <div className="form-card-body">
            <p className="text-sm text-slate-600">
              {rejectTarget.type === 'timeoff'
                ? 'Are you sure you want to reject this time off request?'
                : 'Are you sure you want to reject this payment request?'}
            </p>
            {rejectTarget.type === 'payment' && (
              <div className="form-field mt-4">
                <label className="form-label form-label-optional" htmlFor="reject-payment-reason">
                  Rejection reason (optional)
                </label>
                <input
                  id="reject-payment-reason"
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Hours not verified"
                />
              </div>
            )}
            <div className="form-actions mt-5">
              <button type="button" onClick={() => setRejectTarget(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => (rejectTarget.type === 'timeoff' ? handleRejectTimeOff() : handleRejectPayment())}
                disabled={saving}
                className="btn-brand disabled:opacity-50"
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
