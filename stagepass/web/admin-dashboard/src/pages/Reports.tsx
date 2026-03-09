import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, type ReportsData } from '@/services/api';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

const CHART_COLORS = ['#ca8a04', '#1e2d5c', '#3a5092', '#22c55e', '#ef4444', '#8b5cf6'];

function formatDateShort(d: string) {
  const [y, m, day] = d.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(day));
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function Reports() {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(firstDayOfMonth.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(() => {
    setLoading(true);
    setError(null);
    api.reports
      .get(from, to)
      .then(setData)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load reports');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  if (loading && !data) {
    return <Preloader message="Loading reports…" fullScreen />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Financial, attendance, events and arrival reports for the selected period. Management view."
      />

      <SectionCard sectionLabel="Period">
        <div className="flex flex-wrap items-end gap-4 p-6">
          <div className="form-field">
            <label className="form-label" htmlFor="report-from">From</label>
            <input
              id="report-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="form-input w-auto min-w-[10rem]"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="report-to">To</label>
            <input
              id="report-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="form-input w-auto min-w-[10rem]"
            />
          </div>
          <button type="button" onClick={fetchReports} disabled={loading} className="btn-brand disabled:opacity-50">
            {loading ? 'Loading…' : 'Apply'}
          </button>
        </div>
      </SectionCard>

      {error && (
        <div className="form-error-banner">{error}</div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-3 py-12 text-slate-600">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-accent" />
          <span>Loading reports…</span>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Financial */}
          <SectionCard sectionLabel="Financial report">
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total payments</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{data.financial.summary.total_payments}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total amount</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {Number(data.financial.summary.total_amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-green-700">Approved</p>
                  <p className="mt-1 text-xl font-bold text-green-800">
                    {data.financial.summary.by_status.approved?.count ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-amber-700">Pending</p>
                  <p className="mt-1 text-xl font-bold text-amber-800">
                    {data.financial.summary.by_status.pending?.count ?? 0}
                  </p>
                </div>
              </div>
              {data.financial.by_day.length > 0 && (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.financial.by_day.map((d) => ({ ...d, label: formatDateShort(d.date) }))}>
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => [Number(value).toFixed(2), 'Amount']} />
                      <Bar dataKey="total" name="Amount" fill="#ca8a04" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {Object.keys(data.financial.summary.by_status).length > 0 && (
                <div className="h-64 max-w-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(data.financial.summary.by_status).map(([name, v]) => ({
                          name: name.charAt(0).toUpperCase() + name.slice(1),
                          value: v.count,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {Object.keys(data.financial.summary.by_status).map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Attendance */}
          <SectionCard sectionLabel="Attendance report">
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total check-ins</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{data.attendance.summary.total_checkins}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total hours</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{data.attendance.summary.total_hours}</p>
                </div>
              </div>
              {data.attendance.by_day.length > 0 && (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.attendance.by_day.map((d) => ({ ...d, label: formatDateShort(d.date) }))}>
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="checkins" name="Check-ins" stroke="#ca8a04" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="hours" name="Hours" stroke="#1e2d5c" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Events */}
          <SectionCard sectionLabel="Events report">
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total events</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{data.events.summary.total_events}</p>
                </div>
                {Object.entries(data.events.summary.by_status).map(([status, count], i) => (
                  <div key={status} className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500 capitalize">{status}</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{count}</p>
                  </div>
                ))}
              </div>
              {data.events.by_day.length > 0 && (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.events.by_day.map((d) => ({ ...d, label: formatDateShort(d.date) }))}>
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Events" fill="#3a5092" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Arrival */}
          <SectionCard sectionLabel="Arrival report">
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total arrivals</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{data.arrival.summary.total_arrivals}</p>
                </div>
              </div>
              {data.arrival.by_day.length > 0 && (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.arrival.by_day.map((d) => ({ ...d, label: formatDateShort(d.date) }))}>
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Arrivals" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {data.arrival.by_event.length > 0 && (
                <div className="h-72">
                  <p className="mb-2 text-sm font-medium text-slate-700">Arrivals by event</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={data.arrival.by_event.slice(0, 10)}
                      margin={{ left: 20, right: 20 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="event" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="arrivals" name="Arrivals" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </SectionCard>
        </>
      )}

      {data && !loading && data.financial.summary.total_payments === 0 && data.attendance.summary.total_checkins === 0 && data.events.summary.total_events === 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-6 py-12 text-center text-slate-600">
          No data for the selected period. Try a different date range.
        </div>
      )}
    </div>
  );
}
