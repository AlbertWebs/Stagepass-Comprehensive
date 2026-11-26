import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { api, type ReportFinancialResponse } from '@/services/api';

const today = new Date();
const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const firstOfMonth = dateValue(new Date(today.getFullYear(), today.getMonth(), 1));
const money = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 2 }).format(value || 0);

export default function FinancialReports() {
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(dateValue(today));
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<ReportFinancialResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setReport(await api.reports.financial({ date_from: from, date_to: to, page, per_page: 25 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the financial report.');
    } finally {
      setLoading(false);
    }
  }, [from, to, page]);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = async () => {
    if (!report || exporting) return;
    setExporting(true);
    setError('');
    try {
      const filters = { date_from: from, date_to: to, per_page: 100 };
      const firstPage = await api.reports.financial({ ...filters, page: 1 });
      const allRows = [...firstPage.data];
      for (let currentPage = 2; currentPage <= firstPage.pagination.last_page; currentPage += 1) {
        const nextPage = await api.reports.financial({ ...filters, page: currentPage });
        allRows.push(...nextPage.data);
      }

      const csvCell = (cell: unknown) => {
        const value = String(cell ?? '');
        const safeValue = /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
        return `"${safeValue.replace(/"/g, '""')}"`;
      };
      const rows = [
        ['Stagepass Financial Report', `${from} to ${to}`],
        ['Payment date', 'Event', 'Crew member', 'Purpose', 'Status', 'Amount (KES)'],
        ...allRows.map((row) => [row.payment_date ?? '', row.event?.name ?? '', row.user?.name ?? '', row.purpose ?? '', row.status, Number(row.total_amount).toFixed(2)]),
        ['', '', '', 'Total', '', Number(firstPage.summary.total_amount).toFixed(2)],
      ];
      const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `stagepass-financial-${from}-${to}.csv`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export the full report.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Financial reports" subtitle="Review payment obligations and processed payments for the selected period. Amounts are shown in Kenyan shillings." action={<button onClick={() => void exportCsv()} disabled={!report || loading || exporting} className="btn-brand disabled:opacity-50">{exporting ? 'Preparing…' : 'Export full CSV'}</button>} />
      <section className="card-elegant flex flex-wrap items-end gap-4 p-4">
        <label className="text-sm font-medium text-slate-700">From<input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="form-input mt-1.5" /></label>
        <label className="text-sm font-medium text-slate-700">To<input type="date" value={to} min={from} max={dateValue(today)} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="form-input mt-1.5" /></label>
        <button onClick={() => void load()} disabled={loading} className="btn-secondary">{loading ? 'Refreshing…' : 'Refresh report'}</button>
      </section>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Payments in period', report?.summary.total_payments ?? 0],
          ['Total obligations', money(report?.summary.total_amount ?? 0)],
          ['Pending', report?.summary.by_status.pending?.count ?? 0],
          ['Approved', report?.summary.by_status.approved?.count ?? 0],
        ].map(([label, value]) => <div key={String(label)} className="dashboard-stat-card p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p></div>)}
      </section>
      <section className="card-elegant overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Payment detail</h2><span className="text-sm text-slate-500">{report?.pagination.total ?? 0} records</span></div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Payment date</th><th className="px-5 py-3">Event</th><th className="px-5 py-3">Crew member</th><th className="px-5 py-3">Purpose</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">Loading payment records…</td></tr> : report?.data.length ? report.data.map((row) => <tr key={row.id} className="hover:bg-slate-50/70"><td className="whitespace-nowrap px-5 py-3">{row.payment_date || '—'}</td><td className="px-5 py-3">{row.event?.name || '—'}</td><td className="px-5 py-3">{row.user?.name || '—'}</td><td className="px-5 py-3">{row.purpose || '—'}</td><td className="px-5 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">{row.status}</span></td><td className="whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums">{money(Number(row.total_amount))}</td></tr>) : <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">No payment records found for these dates.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm"><span>Page {report?.pagination.current_page ?? 1} of {report?.pagination.last_page ?? 1}</span><div className="flex gap-2"><button disabled={!report || page <= 1 || loading} onClick={() => setPage((n) => n - 1)} className="btn-secondary px-3 py-1.5 disabled:opacity-40">Previous</button><button disabled={!report || page >= report.pagination.last_page || loading} onClick={() => setPage((n) => n + 1)} className="btn-secondary px-3 py-1.5 disabled:opacity-40">Next</button></div></div>
      </section>
    </div>
  );
}
