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
import {
  api,
  type Event,
  type ReportCrewAttendanceResponse,
  type ReportCrewPaymentsResponse,
  type ReportEventsResponse,
  type ReportFinancialResponse,
  type ReportFilters,
  type ReportTasksResponse,
  type ReportType,
  type ReportsData,
} from '@/services/api';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

const CHART_COLORS = ['#ca8a04', '#1e2d5c', '#3a5092', '#22c55e', '#ef4444', '#8b5cf6'];

const REPORT_TABS: { id: ReportType; label: string }[] = [
  { id: 'events', label: 'Events' },
  { id: 'crew-attendance', label: 'Crew attendance' },
  { id: 'crew-payments', label: 'Crew payments' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'financial', label: 'Financials' },
];

function formatDateShort(d: string) {
  const [y, m, day] = d.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(day));
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatDate(d: string) {
  try {
    const [y, m, day] = d.split('-');
    const date = new Date(Number(y), Number(m) - 1, Number(day));
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

function escapeCsvCell(s: string | number): string {
  const str = String(s ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const line = (row: (string | number)[]) => row.map(escapeCsvCell).join(',');
  const csv = [line(headers), ...rows.map((row) => line(row))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [activeTab, setActiveTab] = useState<ReportType>('events');
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(today.toISOString().slice(0, 10));
  const [month, setMonth] = useState<number | ''>(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [useDateRange, setUseDateRange] = useState(true);
  const [eventId, setEventId] = useState<number | ''>('');
  const [userId, setUserId] = useState<number | ''>('');
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);

  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);

  const [legacyData, setLegacyData] = useState<ReportsData | null>(null);
  const [legacyFrom, setLegacyFrom] = useState(firstDayOfMonth.toISOString().slice(0, 10));
  const [legacyTo, setLegacyTo] = useState(today.toISOString().slice(0, 10));
  const [legacyLoading, setLegacyLoading] = useState(false);

  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [eventsReport, setEventsReport] = useState<ReportEventsResponse | null>(null);
  const [attendanceReport, setAttendanceReport] = useState<ReportCrewAttendanceResponse | null>(null);
  const [paymentsReport, setPaymentsReport] = useState<ReportCrewPaymentsResponse | null>(null);
  const [tasksReport, setTasksReport] = useState<ReportTasksResponse | null>(null);
  const [financialReport, setFinancialReport] = useState<ReportFinancialResponse | null>(null);
  const [exporting, setExporting] = useState(false);

  const buildFilters = useCallback((): ReportFilters => {
    const f: ReportFilters = { page, per_page: perPage };
    if (useDateRange) {
      f.date_from = dateFrom;
      f.date_to = dateTo;
    } else if (month !== '' && year) {
      f.month = month as number;
      f.year = year;
    } else if (year) {
      f.year = year;
    }
    if (eventId !== '') f.event_id = eventId as number;
    if (userId !== '') f.user_id = userId as number;
    return f;
  }, [useDateRange, dateFrom, dateTo, month, year, eventId, userId, page, perPage]);

  const fetchReport = useCallback((pageNum?: number) => {
    const p = pageNum ?? page;
    setReportLoading(true);
    setReportError(null);
    const f = buildFilters();
    const fPage = { ...f, page: p, per_page: perPage };

    const run = async () => {
      try {
        switch (activeTab) {
          case 'events':
            setEventsReport(await api.reports.events(fPage));
            setAttendanceReport(null);
            setPaymentsReport(null);
            setTasksReport(null);
            setFinancialReport(null);
            break;
          case 'crew-attendance':
            setAttendanceReport(await api.reports.crewAttendance(fPage));
            setEventsReport(null);
            setPaymentsReport(null);
            setTasksReport(null);
            setFinancialReport(null);
            break;
          case 'crew-payments':
            setPaymentsReport(await api.reports.crewPayments(fPage));
            setEventsReport(null);
            setAttendanceReport(null);
            setTasksReport(null);
            setFinancialReport(null);
            break;
          case 'tasks':
            setTasksReport(await api.reports.tasks(fPage));
            setEventsReport(null);
            setAttendanceReport(null);
            setPaymentsReport(null);
            setFinancialReport(null);
            break;
          case 'financial':
            setFinancialReport(await api.reports.financial(fPage));
            setEventsReport(null);
            setAttendanceReport(null);
            setPaymentsReport(null);
            setTasksReport(null);
            break;
        }
      } catch (e) {
        setReportError(e instanceof Error ? e.message : 'Failed to load report');
      } finally {
        setReportLoading(false);
      }
    };
    run();
  }, [activeTab, buildFilters, page, perPage]);

  useEffect(() => {
    api.events.list({ per_page: 500 }).then((r) => setEvents(r.data ?? [])).catch(() => setEvents([]));
    api.users.list({ per_page: 500 }).then((r) => setUsers(r.data?.map((u) => ({ id: u.id, name: u.name })) ?? [])).catch(() => setUsers([]));
  }, []);

  const handleExportPdf = useCallback(async () => {
    setExporting(true);
    try {
      const { html, title } = await api.reports.exportHtml(activeTab, buildFilters());
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => {
          w.print();
        }, 500);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [activeTab, buildFilters]);

  const handleExportCsv = useCallback(() => {
    const f = activeTab;
    if (f === 'events' && eventsReport?.data) {
      downloadCsv(
        `events-report-${dateFrom}-${dateTo}.csv`,
        ['Event', 'Date', 'Status'],
        eventsReport.data.map((e) => [e.name, e.date, e.status ?? ''])
      );
    } else if (f === 'crew-attendance' && attendanceReport?.data) {
      downloadCsv(
        `crew-attendance-${dateFrom}-${dateTo}.csv`,
        ['Crew', 'Event', 'Check-in', 'Check-out', 'Hours'],
        attendanceReport.data.map((a) => [
          a.user?.name ?? '',
          a.event?.name ?? '',
          a.checkin_time ?? '',
          a.checkout_time ?? '',
          a.total_hours ?? '',
        ])
      );
    } else if (f === 'crew-payments' && paymentsReport?.data) {
      downloadCsv(
        `crew-payments-${dateFrom}-${dateTo}.csv`,
        ['Crew', 'Event', 'Date', 'Amount', 'Status'],
        paymentsReport.data.map((p) => [
          p.user?.name ?? '',
          p.event?.name ?? '',
          p.payment_date ?? '',
          p.total_amount,
          p.status,
        ])
      );
    } else if (f === 'tasks' && tasksReport?.data) {
      downloadCsv(
        `tasks-${dateFrom}-${dateTo}.csv`,
        ['Task', 'Event', 'Due date', 'Status', 'Assignees'],
        tasksReport.data.map((t) => [
          t.title,
          t.event?.name ?? '',
          t.due_date ?? '',
          t.status,
          (t.assignees ?? []).map((a) => a.name).join('; '),
        ])
      );
    } else if (f === 'financial' && financialReport?.data) {
      downloadCsv(
        `financial-${dateFrom}-${dateTo}.csv`,
        ['Crew', 'Event', 'Date', 'Amount', 'Status'],
        financialReport.data.map((p) => [
          p.user?.name ?? '',
          p.event?.name ?? '',
          p.payment_date ?? '',
          p.total_amount,
          p.status,
        ])
      );
    }
  }, [activeTab, eventsReport, attendanceReport, paymentsReport, tasksReport, financialReport, dateFrom, dateTo]);

  const fetchLegacy = useCallback(() => {
    setLegacyLoading(true);
    api.reports
      .get(legacyFrom, legacyTo)
      .then(setLegacyData)
      .catch(() => setLegacyData(null))
      .finally(() => setLegacyLoading(false));
  }, [legacyFrom, legacyTo]);

  useEffect(() => {
    fetchLegacy();
  }, [fetchLegacy]);

  const hasReportData =
    eventsReport ||
    attendanceReport ||
    paymentsReport ||
    tasksReport ||
    financialReport;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Event, crew attendance, payments, tasks and financial reports. Filter by date range, event or crew member and export to PDF or CSV."
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
              setReportError(null);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <SectionCard sectionLabel="Filters">
        <div className="flex flex-wrap items-end gap-4 p-6">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={useDateRange}
              onChange={() => setUseDateRange(true)}
              className="form-radio text-brand-600"
            />
            <span className="text-sm">Date range</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!useDateRange}
              onChange={() => setUseDateRange(false)}
              className="form-radio text-brand-600"
            />
            <span className="text-sm">Month / Year</span>
          </label>
          {useDateRange ? (
            <>
              <div className="form-field">
                <label className="form-label" htmlFor="report-from">From</label>
                <input
                  id="report-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="form-input w-auto min-w-[10rem]"
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="report-to">To</label>
                <input
                  id="report-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="form-input w-auto min-w-[10rem]"
                />
              </div>
            </>
          ) : (
            <>
              <div className="form-field">
                <label className="form-label" htmlFor="report-month">Month</label>
                <select
                  id="report-month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value === '' ? '' : Number(e.target.value))}
                  className="form-input w-auto min-w-[8rem]"
                >
                  <option value="">All</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="report-year">Year</label>
                <input
                  id="report-year"
                  type="number"
                  min={2020}
                  max={2030}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
                  className="form-input w-auto min-w-[6rem]"
                />
              </div>
            </>
          )}
          <div className="form-field">
            <label className="form-label" htmlFor="report-event">Event</label>
            <select
              id="report-event"
              value={eventId === '' ? '' : eventId}
              onChange={(e) => setEventId(e.target.value === '' ? '' : Number(e.target.value))}
              className="form-input w-auto min-w-[12rem]"
            >
              <option value="">All events</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.date})
                </option>
              ))}
            </select>
          </div>
          {(activeTab === 'crew-attendance' || activeTab === 'crew-payments' || activeTab === 'tasks' || activeTab === 'financial') && (
            <div className="form-field">
              <label className="form-label" htmlFor="report-user">Crew member</label>
              <select
                id="report-user"
                value={userId === '' ? '' : userId}
                onChange={(e) => setUserId(e.target.value === '' ? '' : Number(e.target.value))}
                className="form-input w-auto min-w-[10rem]"
              >
                <option value="">All crew</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={() => { setPage(1); fetchReport(1); }}
            disabled={reportLoading}
            className="btn-brand disabled:opacity-50"
          >
            {reportLoading ? 'Loading…' : 'Generate report'}
          </button>
          {hasReportData && (
            <>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exporting}
                className="btn-secondary disabled:opacity-50"
              >
                {exporting ? 'Preparing…' : 'Export PDF'}
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="btn-secondary"
              >
                Export CSV
              </button>
            </>
          )}
        </div>
      </SectionCard>

      {reportError && (
        <div className="form-error-banner">{reportError}</div>
      )}

      {/* Report summary + table per tab */}
      {activeTab === 'events' && eventsReport && (
        <>
          <EventsReportView data={eventsReport} formatDate={formatDate} />
          <ReportPagination
            pagination={eventsReport.pagination}
            loading={reportLoading}
            onPage={(p) => { setPage(p); fetchReport(p); }}
          />
        </>
      )}
      {activeTab === 'crew-attendance' && attendanceReport && (
        <>
          <CrewAttendanceReportView data={attendanceReport} formatDate={formatDate} />
          <ReportPagination
            pagination={attendanceReport.pagination}
            loading={reportLoading}
            onPage={(p) => { setPage(p); fetchReport(p); }}
          />
        </>
      )}
      {activeTab === 'crew-payments' && paymentsReport && (
        <>
          <CrewPaymentsReportView data={paymentsReport} formatDate={formatDate} />
          <ReportPagination
            pagination={paymentsReport.pagination}
            loading={reportLoading}
            onPage={(p) => { setPage(p); fetchReport(p); }}
          />
        </>
      )}
      {activeTab === 'tasks' && tasksReport && (
        <>
          <TasksReportView data={tasksReport} formatDate={formatDate} />
          <ReportPagination
            pagination={tasksReport.pagination}
            loading={reportLoading}
            onPage={(p) => { setPage(p); fetchReport(p); }}
          />
        </>
      )}
      {activeTab === 'financial' && financialReport && (
        <>
          <FinancialReportView data={financialReport} formatDate={formatDate} />
          <ReportPagination
            pagination={financialReport.pagination}
            loading={reportLoading}
            onPage={(p) => { setPage(p); fetchReport(p); }}
          />
        </>
      )}

      {!hasReportData && !reportLoading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-6 py-12 text-center text-slate-600">
          Set filters and click &quot;Generate report&quot; to load data.
        </div>
      )}

      {/* Legacy overview (collapsible or separate section) */}
      <SectionCard sectionLabel="Overview (combined period)">
        <div className="flex flex-wrap items-end gap-4 p-6">
          <div className="form-field">
            <label className="form-label" htmlFor="legacy-from">From</label>
            <input
              id="legacy-from"
              type="date"
              value={legacyFrom}
              onChange={(e) => setLegacyFrom(e.target.value)}
              className="form-input w-auto min-w-[10rem]"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="legacy-to">To</label>
            <input
              id="legacy-to"
              type="date"
              value={legacyTo}
              onChange={(e) => setLegacyTo(e.target.value)}
              className="form-input w-auto min-w-[10rem]"
            />
          </div>
          <button type="button" onClick={fetchLegacy} disabled={legacyLoading} className="btn-brand disabled:opacity-50">
            {legacyLoading ? 'Loading…' : 'Apply'}
          </button>
        </div>
        {legacyData && !legacyLoading && (
          <LegacyCharts data={legacyData} formatDateShort={formatDateShort} />
        )}
      </SectionCard>
    </div>
  );
}

function ReportPagination({
  pagination,
  loading,
  onPage,
}: {
  pagination: { current_page: number; last_page: number; per_page: number; total: number };
  loading: boolean;
  onPage: (page: number) => void;
}) {
  const { current_page, last_page, total } = pagination;
  if (last_page <= 1) return null;
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-sm text-slate-600">
        Page {current_page} of {last_page} ({total} total)
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPage(current_page - 1)}
          disabled={loading || current_page <= 1}
          className="btn-secondary disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPage(current_page + 1)}
          disabled={loading || current_page >= last_page}
          className="btn-secondary disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function LegacyCharts({
  data,
  formatDateShort,
}: {
  data: ReportsData;
  formatDateShort: (d: string) => string;
}) {
  return (
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
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Check-ins</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{data.attendance.summary.total_checkins}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Events</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{data.events.summary.total_events}</p>
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
  );
}

function EventsReportView({
  data,
  formatDate: fd,
}: {
  data: ReportEventsResponse;
  formatDate: (d: string) => string;
}) {
  const { summary, data: list, pagination } = data;
  return (
    <SectionCard sectionLabel="Event report">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total events</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total_events}</p>
          </div>
          {Object.entries(summary.by_status).map(([status, count]) => (
            <div key={status} className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 capitalize">{status}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{count}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-200">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left p-2">Event</th>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="p-2">{e.name}</td>
                  <td className="p-2">{fd(e.date)}</td>
                  <td className="p-2">{e.status ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-slate-500 text-sm">
          Showing {list.length} of {pagination.total}
        </p>
      </div>
    </SectionCard>
  );
}

function CrewAttendanceReportView({
  data,
  formatDate: fd,
}: {
  data: ReportCrewAttendanceResponse;
  formatDate: (d: string) => string;
}) {
  const { summary, data: list, pagination } = data;
  return (
    <SectionCard sectionLabel="Crew attendance report">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Assignments</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total_assignments}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Check-ins</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total_checkins}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-700">Missed</p>
            <p className="mt-1 text-xl font-bold text-amber-800">{summary.missed_checkins}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Participation</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary.participation_rate}%</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total hours</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total_hours}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-200">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left p-2">Crew</th>
                <th className="text-left p-2">Event</th>
                <th className="text-left p-2">Check-in</th>
                <th className="text-left p-2">Check-out</th>
                <th className="text-left p-2">Hours</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="p-2">{a.user?.name ?? '—'}</td>
                  <td className="p-2">{a.event?.name ?? '—'}</td>
                  <td className="p-2">{a.checkin_time ? fd(a.checkin_time.slice(0, 10)) + ' ' + (a.checkin_time.slice(11, 16) ?? '') : '—'}</td>
                  <td className="p-2">{a.checkout_time ? fd(a.checkout_time.slice(0, 10)) + ' ' + (a.checkout_time.slice(11, 16) ?? '') : '—'}</td>
                  <td className="p-2">{a.total_hours ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-slate-500 text-sm">
          Showing {list.length} of {pagination.total}
        </p>
      </div>
    </SectionCard>
  );
}

function CrewPaymentsReportView({
  data,
  formatDate: fd,
}: {
  data: ReportCrewPaymentsResponse;
  formatDate: (d: string) => string;
}) {
  const { summary, data: list, pagination } = data;
  return (
    <SectionCard sectionLabel="Crew payments report">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total_count}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-700">Pending</p>
            <p className="mt-1 text-xl font-bold text-amber-800">{summary.pending_count} / {Number(summary.pending_total).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-green-700">Approved</p>
            <p className="mt-1 text-xl font-bold text-green-800">{summary.approved_count} / {Number(summary.approved_total).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Grand total</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{Number(summary.grand_total).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-200">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left p-2">Crew</th>
                <th className="text-left p-2">Event</th>
                <th className="text-left p-2">Date</th>
                <th className="text-right p-2">Amount</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="p-2">{p.user?.name ?? '—'}</td>
                  <td className="p-2">{p.event?.name ?? '—'}</td>
                  <td className="p-2">{p.payment_date ? fd(String(p.payment_date).slice(0, 10)) : '—'}</td>
                  <td className="p-2 text-right">{Number(p.total_amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td className="p-2">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-slate-500 text-sm">
          Showing {list.length} of {pagination.total}
        </p>
      </div>
    </SectionCard>
  );
}

function TasksReportView({
  data,
  formatDate: fd,
}: {
  data: ReportTasksResponse;
  formatDate: (d: string) => string;
}) {
  const { summary, data: list, pagination } = data;
  return (
    <SectionCard sectionLabel="Task report">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-700">Pending</p>
            <p className="mt-1 text-xl font-bold text-amber-800">{summary.pending}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-blue-700">In progress</p>
            <p className="mt-1 text-xl font-bold text-blue-800">{summary.in_progress}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-green-700">Completed</p>
            <p className="mt-1 text-xl font-bold text-green-800">{summary.completed}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-200">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left p-2">Task</th>
                <th className="text-left p-2">Event</th>
                <th className="text-left p-2">Due date</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Assignees</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="p-2">{t.title}</td>
                  <td className="p-2">{t.event?.name ?? '—'}</td>
                  <td className="p-2">{t.due_date ? fd(t.due_date) : '—'}</td>
                  <td className="p-2">{t.status}</td>
                  <td className="p-2">{(t.assignees ?? []).map((a) => a.name).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-slate-500 text-sm">
          Showing {list.length} of {pagination.total}
        </p>
      </div>
    </SectionCard>
  );
}

function FinancialReportView({
  data,
  formatDate: fd,
}: {
  data: ReportFinancialResponse;
  formatDate: (d: string) => string;
}) {
  const { summary, by_day, data: list, pagination } = data;
  return (
    <SectionCard sectionLabel="Financial summary">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total payments</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total_payments}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total amount</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{Number(summary.total_amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
          </div>
          {Object.entries(summary.by_status).map(([status, v]) => (
            <div key={status} className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 capitalize">{status}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{v.count} / {Number(v.total).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</p>
            </div>
          ))}
        </div>
        {by_day.length > 0 && (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={by_day.map((d) => ({ ...d, label: formatDateShort(d.date) }))}>
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [Number(value).toFixed(2), 'Amount']} />
                <Bar dataKey="total" name="Amount" fill="#ca8a04" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-200">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left p-2">Crew</th>
                <th className="text-left p-2">Event</th>
                <th className="text-left p-2">Date</th>
                <th className="text-right p-2">Amount</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="p-2">{p.user?.name ?? '—'}</td>
                  <td className="p-2">{p.event?.name ?? '—'}</td>
                  <td className="p-2">{p.payment_date ? fd(String(p.payment_date).slice(0, 10)) : '—'}</td>
                  <td className="p-2 text-right">{Number(p.total_amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                  <td className="p-2">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-slate-500 text-sm">
          Showing {list.length} of {pagination.total}
        </p>
      </div>
    </SectionCard>
  );
}
