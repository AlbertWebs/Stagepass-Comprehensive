import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  api,
  type Event,
  type ReportAllowancesResponse,
  type ReportCrewAttendanceResponse,
  type ReportFilters,
  type ReportFullEventResponse,
  type ReportType,
} from '@/services/api';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';

const REPORT_TABS: { id: ReportType; label: string }[] = [
  { id: 'full-event', label: 'Comprehensive' },
  { id: 'allowances', label: 'Allowances' },
  { id: 'crew-attendance', label: 'Attendance' },
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
  const [searchParams] = useSearchParams();
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const eventIdFromUrl = (() => {
    const raw = searchParams.get('event_id');
    if (!raw) return '' as number | '';
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : ('' as number | '');
  })();
  const [activeTab, setActiveTab] = useState<ReportType>('full-event');
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(today.toISOString().slice(0, 10));
  const [month, setMonth] = useState<number | ''>(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [useDateRange, setUseDateRange] = useState(true);
  const [eventId, setEventId] = useState<number | ''>(eventIdFromUrl);
  const [userId, setUserId] = useState<number | ''>('');
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);

  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);

  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [attendanceReport, setAttendanceReport] = useState<ReportCrewAttendanceResponse | null>(null);
  const [allowancesReport, setAllowancesReport] = useState<ReportAllowancesResponse | null>(null);
  const [fullEventReport, setFullEventReport] = useState<ReportFullEventResponse | null>(null);
  const [exporting, setExporting] = useState(false);
  const [projectLeadName, setProjectLeadName] = useState('');
  const [projectLeadSignature, setProjectLeadSignature] = useState('');

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
    if (projectLeadName.trim()) f.confirmed_by = projectLeadName.trim();
    if (projectLeadSignature.trim()) f.signature = projectLeadSignature.trim();
    return f;
  }, [useDateRange, dateFrom, dateTo, month, year, eventId, userId, page, perPage, projectLeadName, projectLeadSignature]);

  const fetchReport = useCallback((pageNum?: number) => {
    const p = pageNum ?? page;
    setReportLoading(true);
    setReportError(null);
    const f = buildFilters();
    const fPage = { ...f, page: p, per_page: perPage };

    const run = async () => {
      try {
        if (activeTab === 'full-event') {
          setFullEventReport(await api.reports.fullEvent(fPage));
          setAttendanceReport(null);
          setAllowancesReport(null);
        } else if (activeTab === 'allowances') {
          setAllowancesReport(await api.reports.allowances(fPage));
          setFullEventReport(null);
          setAttendanceReport(null);
        } else {
          setAttendanceReport(await api.reports.crewAttendance(fPage));
          setFullEventReport(null);
          setAllowancesReport(null);
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

  useEffect(() => {
    const raw = searchParams.get('event_id');
    if (!raw) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    setEventId(n);
    const match = events.find((e) => e.id === n);
    if (match?.date) {
      const from = String(match.date).slice(0, 10);
      const to = match.end_date ? String(match.end_date).slice(0, 10) : from;
      setDateFrom(from);
      setDateTo(to);
      setUseDateRange(true);
    }
  }, [searchParams, events]);

  useEffect(() => {
    if (eventId === '') return;
    const match = events.find((e) => e.id === eventId);
    const leadName = match?.team_leader?.name?.trim();
    if (leadName && !projectLeadName.trim()) {
      setProjectLeadName(leadName);
    }
  }, [eventId, events, projectLeadName]);

  const handleExportPdf = useCallback(async () => {
    setExporting(true);
    try {
      const { html } = await api.reports.exportHtml(activeTab, buildFilters());
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        // Wait for layout/fonts before opening the print dialog
        setTimeout(() => {
          try {
            w.print();
          } catch {
            // ignore
          }
        }, 700);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [activeTab, buildFilters]);

  const handleExportCsv = useCallback(() => {
    if (activeTab === 'full-event' && fullEventReport?.events) {
      const registerRows: (string | number)[][] = [];
      for (const item of fullEventReport.events) {
        for (const r of item.crew_register ?? []) {
          registerRows.push([
            item.event.name,
            r.date ?? '',
            r.name,
            r.breakfast ?? '',
            r.lunch ?? '',
            r.dinner ?? '',
            r.fare_to ?? '',
            r.fare_from ?? '',
            r.fare_total ?? '',
            r.time_in ?? '',
            r.time_out ?? '',
          ]);
        }
      }
      downloadCsv(
        `technical-crew-register-${dateFrom}-${dateTo}.csv`,
        ['Event', 'Date', 'Name', 'Breakfast', 'Lunch', 'Dinner', 'Fare to', 'Fare From', 'Total', 'Time In', 'Time Out'],
        registerRows
      );

      const allowanceRows: (string | number)[][] = [];
      for (const item of fullEventReport.events) {
        for (const a of item.earned_allowances) {
          if (a.meal_slot) continue;
          allowanceRows.push([
            item.event.name,
            item.event.date ?? '',
            a.crew_name,
            a.allowance_type,
            a.amount,
            a.status,
            a.source,
            a.description ?? '',
            a.recorded_at ?? '',
          ]);
        }
      }
      if (allowanceRows.length > 0) {
        downloadCsv(
          `full-event-other-allowances-${dateFrom}-${dateTo}.csv`,
          ['Event', 'Date', 'Crew', 'Allowance type', 'Amount', 'Status', 'Source', 'Description', 'Recorded at'],
          allowanceRows
        );
      }
    } else if (activeTab === 'allowances' && allowancesReport?.data) {
      downloadCsv(
        `allowances-${dateFrom}-${dateTo}.csv`,
        ['Event', 'Date', 'Crew', 'Type', 'Slot', 'Amount', 'Status', 'Source', 'Description', 'Recorded at'],
        allowancesReport.data.map((a) => [
          a.event_name,
          a.meal_grant_date ?? a.event_date ?? '',
          a.crew_name,
          a.allowance_type,
          a.meal_slot ?? '',
          a.amount,
          a.status,
          a.source,
          a.description ?? '',
          a.recorded_at ?? '',
        ])
      );
    } else if (activeTab === 'crew-attendance' && attendanceReport?.data) {
      downloadCsv(
        `crew-attendance-${dateFrom}-${dateTo}.csv`,
        ['Crew', 'Event', 'Work date', 'Check-in', 'Check-out', 'Hours', 'Extra hours'],
        attendanceReport.data.map((a) => [
          a.user?.name ?? '',
          a.event?.name ?? '',
          a.work_date ?? '',
          a.checkin_time ?? '',
          a.checkout_time ?? '',
          a.total_hours ?? '',
          a.extra_hours ?? '',
        ])
      );
    }
  }, [activeTab, fullEventReport, allowancesReport, attendanceReport, dateFrom, dateTo]);

  const hasReportData = fullEventReport || allowancesReport || attendanceReport;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Comprehensive dossier, allowances-only, or attendance-only. Filters auto-apply; export PDF or CSV."
      />

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
          {activeTab === 'full-event' && eventId === '' && (
            <p className="w-full text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Tip: select a specific event for a single-event dossier, or leave as All events to export every event in the date range (includes full allowance breakdown).
            </p>
          )}
          <div className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-800">Project lead sign-off (for PDF)</p>
            <p className="mb-3 text-xs text-slate-500">
              These appear as a signature block at the bottom of the printable report. Leave blank to print empty lines for wet-ink signing.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="form-field min-w-[14rem] flex-1">
                <label className="form-label" htmlFor="project-lead-name">Project lead name</label>
                <input
                  id="project-lead-name"
                  type="text"
                  value={projectLeadName}
                  onChange={(e) => setProjectLeadName(e.target.value)}
                  className="form-input"
                  placeholder="e.g. team leader name"
                  maxLength={120}
                />
              </div>
              <div className="form-field min-w-[14rem] flex-1">
                <label className="form-label" htmlFor="project-lead-signature">Signature (typed)</label>
                <input
                  id="project-lead-signature"
                  type="text"
                  value={projectLeadSignature}
                  onChange={(e) => setProjectLeadSignature(e.target.value)}
                  className="form-input"
                  placeholder="Type name to sign, or leave blank"
                  maxLength={120}
                />
              </div>
            </div>
          </div>
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

      {activeTab === 'full-event' && fullEventReport && (
        <FullEventReportView data={fullEventReport} formatDate={formatDate} />
      )}
      {activeTab === 'allowances' && allowancesReport && (
        <>
          <AllowancesReportView data={allowancesReport} formatDate={formatDate} />
          <ReportPagination
            pagination={allowancesReport.pagination}
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

      {!hasReportData && !reportLoading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-6 py-12 text-center text-slate-600">
          Set filters and click &quot;Generate report&quot; to load data.
        </div>
      )}
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


function FullEventReportView({
  data,
  formatDate: fd,
}: {
  data: ReportFullEventResponse;
  formatDate: (d: string) => string;
}) {
  const { summary, events: list } = data;
  const money = (n: number) =>
    Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const amountCell = (n: number | null | undefined) =>
    n == null || Number.isNaN(Number(n)) || Number(n) === 0 ? '' : money(Number(n));

  return (
    <SectionCard sectionLabel="Comprehensive allowance report">
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Events</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summary.events_count}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-700">Earned allowances</p>
            <p className="mt-1 text-xl font-bold text-amber-900">{money(summary.earned_allowances_total)}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-green-700">Approved / paid</p>
            <p className="mt-1 text-xl font-bold text-green-900">{money(summary.earned_allowances_approved_paid)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Payment totals</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{money(summary.payment_grand_total)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Combined outflow</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{money(summary.combined_outflow)}</p>
          </div>
        </div>

        {list.length === 0 ? (
          <p className="text-sm text-slate-500">No events found for the selected filters.</p>
        ) : (
          list.map((item) => {
            const ev = item.event;
            const dateLabel =
              ev.end_date && ev.end_date !== ev.date
                ? `${ev.date ? fd(ev.date) : '—'} – ${fd(ev.end_date)}`
                : ev.date
                  ? fd(ev.date)
                  : '—';
            const register = item.crew_register ?? [];
            const registerTotals = {
              breakfast: register.reduce((sum, r) => sum + (Number(r.breakfast) || 0), 0),
              lunch: register.reduce((sum, r) => sum + (Number(r.lunch) || 0), 0),
              dinner: register.reduce((sum, r) => sum + (Number(r.dinner) || 0), 0),
              fareTo: register.reduce((sum, r) => sum + (Number(r.fare_to) || 0), 0),
              fareFrom: register.reduce((sum, r) => sum + (Number(r.fare_from) || 0), 0),
              fareTotal: register.reduce((sum, r) => sum + (Number(r.fare_total) || 0), 0),
            };
            const otherAllowances = item.earned_allowances.filter((a) => !a.meal_slot);
            return (
              <div key={ev.id} className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Stagepass Audio Visual · Technical crew register
                      </p>
                      <h3 className="text-base font-semibold text-slate-900">{ev.name}</h3>
                    </div>
                    <p className="text-sm text-slate-600">{dateLabel}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {[
                      ev.location_name ? `Venue: ${ev.location_name}` : null,
                      ev.start_time ? `Call time: ${String(ev.start_time).slice(0, 5)}` : null,
                      ev.team_leader ? `Project team leader: ${ev.team_leader}` : null,
                      ev.status,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="p-4 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border border-slate-300 text-sm">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 p-2 text-left" rowSpan={2}>
                            Date
                          </th>
                          <th className="border border-slate-300 p-2 text-left" rowSpan={2}>
                            Name
                          </th>
                          <th className="border border-slate-300 p-2 text-center" colSpan={3}>
                            Meals (KES)
                          </th>
                          <th className="border border-slate-300 p-2 text-center" colSpan={3}>
                            Transport (KES)
                          </th>
                          <th className="border border-slate-300 p-2 text-left" rowSpan={2}>
                            Time In
                          </th>
                          <th className="border border-slate-300 p-2 text-left" rowSpan={2}>
                            Time Out
                          </th>
                        </tr>
                        <tr className="bg-slate-50">
                          <th className="border border-slate-300 p-2 text-right font-medium">Breakfast</th>
                          <th className="border border-slate-300 p-2 text-right font-medium">Lunch</th>
                          <th className="border border-slate-300 p-2 text-right font-medium">Dinner</th>
                          <th className="border border-slate-300 p-2 text-right font-medium">Fare to</th>
                          <th className="border border-slate-300 p-2 text-right font-medium">Fare From</th>
                          <th className="border border-slate-300 p-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {register.length === 0 ? (
                          <tr>
                            <td className="border border-slate-300 p-3 text-slate-500" colSpan={10}>
                              No crew register rows for this event.
                            </td>
                          </tr>
                        ) : (
                          <>
                            {register.map((r, idx) => (
                              <tr key={`${r.user_id}-${r.date ?? 'na'}-${idx}`} className="bg-white">
                                <td className="border border-slate-300 p-2 whitespace-nowrap">
                                  {r.date ? fd(r.date) : '—'}
                                </td>
                                <td className="border border-slate-300 p-2 font-medium text-slate-900">{r.name}</td>
                                <td className="border border-slate-300 p-2 text-right tabular-nums">{amountCell(r.breakfast)}</td>
                                <td className="border border-slate-300 p-2 text-right tabular-nums">{amountCell(r.lunch)}</td>
                                <td className="border border-slate-300 p-2 text-right tabular-nums">{amountCell(r.dinner)}</td>
                                <td className="border border-slate-300 p-2 text-right tabular-nums">{amountCell(r.fare_to)}</td>
                                <td className="border border-slate-300 p-2 text-right tabular-nums">{amountCell(r.fare_from)}</td>
                                <td className="border border-slate-300 p-2 text-right tabular-nums font-medium">
                                  {amountCell(r.fare_total)}
                                </td>
                                <td className="border border-slate-300 p-2 whitespace-nowrap">{r.time_in ?? ''}</td>
                                <td className="border border-slate-300 p-2 whitespace-nowrap">{r.time_out ?? ''}</td>
                              </tr>
                            ))}
                            <tr className="bg-slate-100 font-semibold">
                              <td className="border border-slate-300 p-2" colSpan={2}>
                                Totals
                              </td>
                              <td className="border border-slate-300 p-2 text-right tabular-nums">
                                {money(registerTotals.breakfast)}
                              </td>
                              <td className="border border-slate-300 p-2 text-right tabular-nums">
                                {money(registerTotals.lunch)}
                              </td>
                              <td className="border border-slate-300 p-2 text-right tabular-nums">
                                {money(registerTotals.dinner)}
                              </td>
                              <td className="border border-slate-300 p-2 text-right tabular-nums">
                                {registerTotals.fareTo > 0 ? money(registerTotals.fareTo) : ''}
                              </td>
                              <td className="border border-slate-300 p-2 text-right tabular-nums">
                                {registerTotals.fareFrom > 0 ? money(registerTotals.fareFrom) : ''}
                              </td>
                              <td className="border border-slate-300 p-2 text-right tabular-nums">
                                {money(registerTotals.fareTotal)}
                              </td>
                              <td className="border border-slate-300 p-2" colSpan={2} />
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {otherAllowances.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-slate-800">Other allowances (non-meal)</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border border-slate-200">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="text-left p-2">Crew</th>
                              <th className="text-left p-2">Type</th>
                              <th className="text-right p-2">Amount</th>
                              <th className="text-left p-2">Status</th>
                              <th className="text-left p-2">Source</th>
                              <th className="text-left p-2">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {otherAllowances.map((a) => (
                              <tr key={a.id} className="border-t border-slate-100">
                                <td className="p-2">{a.crew_name}</td>
                                <td className="p-2">{a.allowance_type}</td>
                                <td className="p-2 text-right">{money(a.amount)}</td>
                                <td className="p-2 capitalize">{a.status}</td>
                                <td className="p-2">{a.source}</td>
                                <td className="p-2">{a.description || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {(item.payments?.length ?? 0) > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-slate-800">Payment requests</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border border-slate-200">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="text-left p-2">Crew</th>
                              <th className="text-left p-2">Purpose</th>
                              <th className="text-right p-2">Allowances</th>
                              <th className="text-right p-2">Per diem</th>
                              <th className="text-right p-2">Total</th>
                              <th className="text-left p-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.payments.map((p) => (
                              <tr key={p.id} className="border-t border-slate-100">
                                <td className="p-2">{p.crew_name}</td>
                                <td className="p-2 capitalize">{p.purpose ?? '—'}</td>
                                <td className="p-2 text-right">{money(p.allowances)}</td>
                                <td className="p-2 text-right">{money(p.per_diem)}</td>
                                <td className="p-2 text-right">{money(p.total_amount)}</td>
                                <td className="p-2 capitalize">{p.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </SectionCard>
  );
}


function formatAttendanceDateTime(value: string | null | undefined, formatDate: (d: string) => string): string {
  if (!value) return '—';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const datePart = normalized.slice(0, 10);
  const timePart = normalized.slice(11, 16);
  if (!datePart) return value;
  return `${formatDate(datePart)}${timePart ? ` ${timePart}` : ''}`;
}

function AllowancesReportView({
  data,
  formatDate: fd,
}: {
  data: ReportAllowancesResponse;
  formatDate: (d: string) => string;
}) {
  const { summary, data: list, pagination } = data;
  const money = (n: number) =>
    Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <SectionCard sectionLabel="Allowances report">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Breakfast</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{money(summary.breakfast_total)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Lunch</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{money(summary.lunch_total)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Dinner</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{money(summary.dinner_total)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Other</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{money(summary.other_total)}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-700">Meals total</p>
            <p className="mt-1 text-xl font-bold text-amber-900">{money(summary.meal_total)}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-green-700">Grand total</p>
            <p className="mt-1 text-xl font-bold text-green-900">{money(summary.grand_total)}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-200">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left p-2">Event</th>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Crew</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Slot</th>
                <th className="text-right p-2">Amount</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="p-2">{a.event_name}</td>
                  <td className="p-2 whitespace-nowrap">
                    {a.meal_grant_date ? fd(a.meal_grant_date) : a.event_date ? fd(a.event_date) : '—'}
                  </td>
                  <td className="p-2">{a.crew_name}</td>
                  <td className="p-2">{a.allowance_type}</td>
                  <td className="p-2 capitalize">{a.meal_slot ?? '—'}</td>
                  <td className="p-2 text-right tabular-nums">{money(a.amount)}</td>
                  <td className="p-2 capitalize">{a.status}</td>
                  <td className="p-2">{a.source}</td>
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
                <th className="text-left p-2">Work date</th>
                <th className="text-left p-2">Check-in</th>
                <th className="text-left p-2">Check-out</th>
                <th className="text-right p-2">Hours</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={`${a.source ?? 'row'}-${a.id}-${a.work_date ?? ''}-${a.checkin_time ?? ''}`} className="border-t border-slate-100">
                  <td className="p-2">{a.user?.name ?? '—'}</td>
                  <td className="p-2">{a.event?.name ?? '—'}</td>
                  <td className="p-2">{a.work_date ? fd(a.work_date) : '—'}</td>
                  <td className="p-2 whitespace-nowrap">{formatAttendanceDateTime(a.checkin_time, fd)}</td>
                  <td className="p-2 whitespace-nowrap">{formatAttendanceDateTime(a.checkout_time, fd)}</td>
                  <td className="p-2 text-right tabular-nums">
                    {a.total_hours != null ? a.total_hours : '—'}
                    {a.extra_hours != null && a.extra_hours > 0 ? (
                      <span className="ml-1 text-xs text-slate-500">(+{a.extra_hours} OT)</span>
                    ) : null}
                  </td>
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

