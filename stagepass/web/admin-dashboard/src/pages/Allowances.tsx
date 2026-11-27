import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type EarnedAllowanceDetail } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';

function formatMoney(n: number): string {
  return `KES ${Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPayDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dateOnly = typeof d === 'string' && d.length >= 10 ? d.slice(0, 10) : String(d).slice(0, 10);
  const [y, m, day] = dateOnly.split('-');
  if (y && m && day) {
    try {
      const date = new Date(Number(y), Number(m) - 1, Number(day));
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    } catch {
      return dateOnly;
    }
  }
  return dateOnly;
}

function needsHrVerification(row: EarnedAllowanceDetail): boolean {
  if (row.hr_verified) return false;
  return row.source === 'automatic'
    ? row.status === 'pending'
    : row.status === 'approved';
}

function needsTeamLeaderApproval(row: EarnedAllowanceDetail): boolean {
  return row.source !== 'automatic' && row.status === 'pending';
}

async function loadAllEarnedAllowanceRows(): Promise<EarnedAllowanceDetail[]> {
  const first = await api.payments.earnedAllowances({ per_page: 100, page: 1 });
  const lastPage = Math.max(1, first.pagination?.last_page ?? 1);
  const rest = [];
  for (let page = 2; page <= lastPage; page += 10) {
    const pages = Array.from({ length: Math.min(10, lastPage - page + 1) }, (_, index) => page + index);
    rest.push(...await Promise.all(pages.map((currentPage) => api.payments.earnedAllowances({ per_page: 100, page: currentPage }))));
  }
  return [first, ...rest].flatMap((result) => Array.isArray(result.flat) ? result.flat : []);
}

export default function Allowances() {
  const { user } = useAuth();
  const canViewPayments = hasPermission(user, 'payments.view');
  const canVerifyAllowances = hasPermission(user, 'allowances.verify');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [earnedRows, setEarnedRows] = useState<EarnedAllowanceDetail[]>([]);
  const [earnedEventId, setEarnedEventId] = useState<string>('');
  const [earnedStatus, setEarnedStatus] = useState<string>('');
  const [earnedVerification, setEarnedVerification] = useState<string>('');
  const [workflowStage, setWorkflowStage] = useState<'all' | 'leader' | 'hr' | 'accounts' | 'paid'>('all');
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const earnedRes = await loadAllEarnedAllowanceRows();
      setEarnedRows(Array.isArray(earnedRes) ? earnedRes : []);
    } catch {
      setEarnedRows([]);
      setError('Could not load allowances data. Check your connection and API settings, then try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredEarnedRows = useMemo(() => {
    let rows = earnedRows;
    if (workflowStage === 'leader') rows = rows.filter(needsTeamLeaderApproval);
    if (workflowStage === 'hr') rows = rows.filter(needsHrVerification);
    if (workflowStage === 'accounts') rows = rows.filter((r) => r.status === 'approved' && r.hr_verified);
    if (workflowStage === 'paid') rows = rows.filter((r) => r.status === 'paid');
    if (earnedEventId) {
      const id = Number(earnedEventId);
      rows = rows.filter((r) => r.event_id === id);
    }
    if (earnedStatus) {
      rows = rows.filter((r) => (r.status ?? '') === earnedStatus);
    }
    if (earnedVerification === 'pending') rows = rows.filter(needsHrVerification);
    if (earnedVerification === 'verified') rows = rows.filter((r) => r.hr_verified);
    return rows;
  }, [earnedRows, earnedEventId, earnedStatus, earnedVerification, workflowStage]);

  const allowanceEventOptions = useMemo(() => {
    const byId = new Map<number, string>();
    earnedRows.forEach((row) => {
      if (row.event_id && row.event_name) byId.set(row.event_id, row.event_name);
    });
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [earnedRows]);

  const stats = useMemo(() => {
    const awaitingLeader = earnedRows.filter(needsTeamLeaderApproval);
    const awaitingHr = earnedRows.filter(needsHrVerification);
    const readyForAccounts = earnedRows.filter((row) => row.status === 'approved' && row.hr_verified);
    const paid = earnedRows.filter((row) => row.status === 'paid');
    return {
      awaitingLeaderCount: awaitingLeader.length,
      awaitingLeaderTotal: awaitingLeader.reduce((sum, row) => sum + Number(row.amount), 0),
      awaitingHrCount: awaitingHr.length,
      awaitingHrTotal: awaitingHr.reduce((sum, row) => sum + Number(row.amount), 0),
      readyForAccountsCount: readyForAccounts.length,
      readyForAccountsTotal: readyForAccounts.reduce((sum, row) => sum + Number(row.amount), 0),
      paidCount: paid.length,
      paidTotal: paid.reduce((sum, row) => sum + Number(row.amount), 0),
    };
  }, [earnedRows]);

  const handleVerify = async (row: EarnedAllowanceDetail) => {
    setVerifyingId(row.id);
    setError(null);
    try {
      await api.payments.verifyAllowance(row.id, true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify this allowance.');
    } finally {
      setVerifyingId(null);
    }
  };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn-secondary"
        disabled={loading}
        onClick={() => void load()}
        aria-busy={loading}
      >
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>
      {canViewPayments ? <Link to="/payments" className="btn-primary">Payments</Link> : null}
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Allowances"
        subtitle={canVerifyAllowances ? 'Review allowance records against attendance evidence, verify eligible items, and leave payment approvals to Accounts.' : 'Review allowance eligibility, approval status, and payment records available to your role.'}
        action={headerActions}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={() => { setWorkflowStage('leader'); setEarnedStatus(''); setEarnedVerification(''); }} className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-left shadow-sm transition hover:border-amber-300 hover:bg-amber-50">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Team leader review</p>
          <p className="mt-2 text-2xl font-semibold text-amber-950">{loading ? '…' : stats.awaitingLeaderCount}</p>
          <p className="mt-1 text-xs text-amber-800">{loading ? '' : formatMoney(stats.awaitingLeaderTotal)} awaiting a decision</p>
        </button>
        <button type="button" onClick={() => { setWorkflowStage('hr'); setEarnedStatus(''); setEarnedVerification(''); }} className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-800">HR verification</p>
          <p className="mt-2 text-2xl font-semibold text-blue-950">{loading ? '…' : stats.awaitingHrCount}</p>
          <p className="mt-1 text-xs text-blue-800">{loading ? '' : formatMoney(stats.awaitingHrTotal)} awaiting review</p>
        </button>
        <button type="button" onClick={() => { setWorkflowStage('accounts'); setEarnedStatus(''); setEarnedVerification(''); }} className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 text-left shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-800">Ready for Accounts</p>
          <p className="mt-2 text-2xl font-semibold text-indigo-950">{loading ? '…' : stats.readyForAccountsCount}</p>
          <p className="mt-1 text-xs text-indigo-800">{loading ? '' : formatMoney(stats.readyForAccountsTotal)} verified and approved</p>
        </button>
        <button type="button" onClick={() => { setWorkflowStage('paid'); setEarnedStatus(''); setEarnedVerification(''); }} className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Paid</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-950">{loading ? '…' : stats.paidCount}</p>
          <p className="mt-1 text-xs text-emerald-800">{loading ? '' : formatMoney(stats.paidTotal)} completed</p>
        </button>
      </div>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <p>{error}</p>
          <button type="button" className="mt-2 text-sm font-medium text-red-900 underline hover:no-underline" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : null}

      <SectionCard sectionLabel="Allowance workflow">
        <div className="p-5 sm:p-6">
          <p className="mb-4 text-sm text-slate-600">
            Move each record through team leader review, HR verification, and Accounts payout. Select a stage above to focus the table.
          </p>
          <div className="mb-4 flex flex-wrap gap-3">
            {workflowStage !== 'all' ? (
              <button type="button" className="btn-secondary" onClick={() => setWorkflowStage('all')}>Show all stages</button>
            ) : null}
            <select
              className="form-select max-w-xs"
              aria-label="Filter by event"
              value={earnedEventId}
              onChange={(e) => setEarnedEventId(e.target.value)}
              disabled={loading && earnedRows.length === 0}
            >
              <option value="">All events</option>
              {allowanceEventOptions.map((event) => (
                <option key={event.id} value={String(event.id)}>
                  {event.name}
                </option>
              ))}
            </select>
            <select
              className="form-select max-w-xs"
              aria-label="Filter by status"
              value={earnedStatus}
              onChange={(e) => setEarnedStatus(e.target.value)}
              disabled={loading && earnedRows.length === 0}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="paid">Paid</option>
            </select>
            <select
              className="form-select max-w-xs"
              aria-label="Filter by HR verification"
              value={earnedVerification}
              onChange={(e) => setEarnedVerification(e.target.value)}
            >
              <option value="">All HR verification states</option>
              <option value="pending">Awaiting HR verification</option>
              <option value="verified">HR verified</option>
            </select>
          </div>
          {loading && earnedRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading earned allowances…</p>
          ) : filteredEarnedRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No rows match your filters.</p>
          ) : (
            <div className="overflow-x-auto scrollbar-thin -mx-5 sm:-mx-6">
              <table className="w-full min-w-[1180px] table-header-brand">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Event</th>
                    <th>Type</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                    <th>HR verification</th>
                    <th>Requested</th>
                    <th>Approved</th>
                    <th>Approved by</th>
                    <th>Attachment</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEarnedRows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{r.crew_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{r.event_name ?? '—'}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {r.allowance_type}
                        {r.source === 'automatic' ? (
                          <span className="ml-2 text-xs text-slate-500">(auto{r.meal_slot ? ` · ${r.meal_slot}` : ''})</span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-700">{formatMoney(Number(r.amount))}</td>
                      <td className="px-6 py-4 text-sm capitalize text-slate-800">{r.status}</td>
                      <td className="px-6 py-4 text-sm">
                        {r.hr_verified ? (
                          <span className="text-emerald-700">Verified{r.hr_verified_by ? ` · ${r.hr_verified_by}` : ' · legacy approval'}</span>
                        ) : canVerifyAllowances && needsHrVerification(r) ? (
                          <button
                            type="button"
                            className="btn-secondary whitespace-nowrap"
                            disabled={verifyingId === r.id}
                            onClick={() => void handleVerify(r)}
                          >
                            {verifyingId === r.id ? 'Saving…' : 'Verify record'}
                          </button>
                        ) : (
                          <span className="text-amber-700">Awaiting review</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{r.recorded_at ? formatPayDate(r.recorded_at) : '—'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{r.approved_at ? formatPayDate(r.approved_at) : '—'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{r.approved_by ?? '—'}</td>
                      <td className="px-6 py-4 text-sm">
                        {r.attachment_url ? (
                          <a href={r.attachment_url} target="_blank" rel="noreferrer" className="link-brand font-medium">
                            View
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
