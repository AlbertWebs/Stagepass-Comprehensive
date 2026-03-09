import { useCallback, useEffect, useState } from 'react';
import { api, type Paginated, type PaymentItem, type TimeOffRequestItem } from '@/services/api';
import { FormModal } from '@/components/FormModal';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

function formatDate(d: string) {
  try {
    const [y, m, day] = d.split('-');
    const date = new Date(Number(y), Number(m) - 1, Number(day));
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

export default function Approvals() {
  const [timeOffData, setTimeOffData] = useState<Paginated<TimeOffRequestItem> | null>(null);
  const [paymentsData, setPaymentsData] = useState<Paginated<PaymentItem> | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [rejectTimeOff, setRejectTimeOff] = useState<TimeOffRequestItem | null>(null);
  const [rejectPayment, setRejectPayment] = useState<PaymentItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!rejectTimeOff) return;
    setSaving(true);
    setError(null);
    try {
      await api.timeoff.reject(rejectTimeOff.id);
      setRejectTimeOff(null);
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
    if (!rejectPayment) return;
    setSaving(true);
    setError(null);
    try {
      await api.payments.reject(rejectPayment.id);
      setRejectPayment(null);
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        subtitle="Approve or reject pending time off requests and payments in one place."
      />

      {error && <div className="form-error-banner">{error}</div>}

      <SectionCard sectionLabel="Pending time off">
        <div className="overflow-x-auto scrollbar-thin">
          {pendingTimeOff.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-500">No pending time off requests.</div>
          ) : (
            <table className="w-full table-header-brand">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Reason</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingTimeOff.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                    <td className="px-6 py-4 font-medium text-slate-900">{r.user?.name ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-600">{formatDate(r.start_date)}</td>
                    <td className="px-6 py-4 text-slate-600">{formatDate(r.end_date)}</td>
                    <td className="px-6 py-4 text-slate-600">{r.reason ?? '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex gap-3">
                        <button
                          type="button"
                          onClick={() => handleApproveTimeOff(r)}
                          disabled={saving}
                          className="link-brand disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectTimeOff(r)}
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

      <SectionCard sectionLabel="Pending payments">
        <div className="overflow-x-auto scrollbar-thin">
          {pendingPayments.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-500">No pending payments.</div>
          ) : (
            <table className="w-full table-header-brand">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Purpose</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                    <td className="px-6 py-4 font-medium text-slate-900">{p.event?.name ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-600">{p.user?.name ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-600">{Number(p.total_amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-slate-600">{p.purpose ?? '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex gap-3">
                        <button
                          type="button"
                          onClick={() => handleApprovePayment(p)}
                          disabled={saving}
                          className="link-brand disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectPayment(p)}
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

      {rejectTimeOff && (
        <FormModal title="Reject time off" onClose={() => setRejectTimeOff(null)} wide={false}>
          <div className="form-card-body">
            <p className="text-sm text-slate-600">Are you sure you want to reject this time off request?</p>
            <div className="form-actions mt-5">
              <button type="button" onClick={() => setRejectTimeOff(null)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={handleRejectTimeOff} disabled={saving} className="btn-brand disabled:opacity-50">
                {saving ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </FormModal>
      )}

      {rejectPayment && (
        <FormModal title="Reject payment" onClose={() => setRejectPayment(null)} wide={false}>
          <div className="form-card-body">
            <p className="text-sm text-slate-600">Are you sure you want to reject this payment?</p>
            <div className="form-actions mt-5">
              <button type="button" onClick={() => setRejectPayment(null)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={handleRejectPayment} disabled={saving} className="btn-brand disabled:opacity-50">
                {saving ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
}
