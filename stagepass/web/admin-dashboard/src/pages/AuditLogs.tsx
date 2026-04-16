import { useCallback, useEffect, useState } from 'react';
import { api, type AuditLogItem, type Paginated, type User } from '@/services/api';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

const SOURCE_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'web', label: 'Web' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'api', label: 'API' },
];

const METHOD_OPTIONS = [
  { value: '', label: 'All methods' },
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
];

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return '—';
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
}

/** Human-readable label for API path + method (mobile + web audit trail). */
function summarizeOperation(path: string, method: string): string {
  const rules: [RegExp, string][] = [
    [/transfer-user/i, 'Crew transfer'],
    [/assign-user/i, 'Assign to event crew'],
    [/manual-checkin/i, 'Manual crew check-in'],
    [/crew\/\d+\/pause/i, 'Pause crew'],
    [/crew\/\d+\/resume/i, 'Resume crew'],
    [/crew\/\d+\/transport/i, 'Transport record'],
    [/done-for-day/i, 'Event done for the day'],
    [/office-checkin/i, 'Office check-in'],
    [/office-checkout/i, 'Office check-out'],
    [/checkin-on-behalf/i, 'Check-in on behalf'],
    [/attendance\/checkin/i, 'Event check-in'],
    [/attendance\/checkout/i, 'Event check-out'],
    [/timeoff/i, 'Time off'],
    [/payments\/earned-allowances/i, 'Earned allowances'],
    [/payments\/initiate/i, 'Payment request'],
    [/payments\/approve/i, 'Approve payment'],
    [/payments\/reject/i, 'Reject payment'],
    [/tasks/i, 'Tasks'],
    [/communications/i, 'Communications'],
    [/events.*\/notes/i, 'Event notes'],
    [/\/me\/photo/i, 'Profile photo'],
    [/\/me$/i, 'Profile / session'],
    [/events.*\/end/i, 'End event'],
  ];
  for (const [re, label] of rules) {
    if (re.test(path)) return label;
  }
  if (method === 'GET') return 'Read / list';
  if (method === 'DELETE') return 'Delete';
  const tail = path.split('/').filter(Boolean).slice(-3).join('/');
  return tail || path;
}

function statusColor(status: number | null): string {
  if (status == null) return 'bg-slate-100 text-slate-700';
  if (status >= 200 && status < 300) return 'bg-green-100 text-green-800';
  if (status >= 400 && status < 500) return 'bg-amber-100 text-amber-800';
  if (status >= 500) return 'bg-red-100 text-red-800';
  return 'bg-slate-100 text-slate-700';
}

export default function AuditLogs() {
  const [data, setData] = useState<Paginated<AuditLogItem> | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [source, setSource] = useState('');
  const [method, setMethod] = useState('');
  const [userId, setUserId] = useState('');
  const [pathSearch, setPathSearch] = useState('');
  const [mutatingOnly, setMutatingOnly] = useState(false);

  const fetchLogs = useCallback(() => {
    setPageLoading(true);
    api.auditLogs
      .list({
        page,
        per_page: 25,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        source: source || undefined,
        method: method || undefined,
        user_id: userId ? Number(userId) : undefined,
        path: pathSearch || undefined,
        mutating_only: mutatingOnly ? 1 : undefined,
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setPageLoading(false));
  }, [page, dateFrom, dateTo, source, method, userId, pathSearch, mutatingOnly]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    api.users.list({}).then((r) => setUsers(r.data ?? [])).catch(() => setUsers([]));
  }, []);

  if (pageLoading && !data) {
    return <Preloader message="Loading audit logs…" fullScreen />;
  }

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const currentPage = data?.current_page ?? 1;
  const lastPage = data?.last_page ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        subtitle="Every authenticated API call is logged with the user who made it. The mobile app sends X-App-Source so requests appear as Mobile; the web admin appears as Web. Filter by Mobile to see field operations (check-in, crew, tasks, time off, payments)."
      />

      <SectionCard sectionLabel="Filters">
        <div className="flex flex-wrap items-end gap-4 p-6">
          <div className="form-field">
            <label className="form-label" htmlFor="al-date-from">From</label>
            <input
              id="al-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="form-input w-auto min-w-[10rem]"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="al-date-to">To</label>
            <input
              id="al-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="form-input w-auto min-w-[10rem]"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="al-source">Source</label>
            <select
              id="al-source"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPage(1);
              }}
              className="form-select w-auto min-w-[8rem]"
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="al-method">Method</label>
            <select
              id="al-method"
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
                setPage(1);
              }}
              className="form-select w-auto min-w-[8rem]"
            >
              {METHOD_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="al-user">User</label>
            <select
              id="al-user"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setPage(1);
              }}
              className="form-select w-auto min-w-[12rem]"
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="al-path">Path contains</label>
            <input
              id="al-path"
              type="text"
              value={pathSearch}
              onChange={(e) => {
                setPathSearch(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. events, payments"
              className="form-input w-48"
            />
          </div>
          <div className="form-field flex flex-col gap-1">
            <label className="form-label" htmlFor="al-mutating">
              Write operations only
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                id="al-mutating"
                type="checkbox"
                checked={mutatingOnly}
                onChange={(e) => {
                  setMutatingOnly(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>POST, PUT, PATCH, DELETE (hide reads)</span>
            </label>
          </div>
          <button type="button" onClick={() => fetchLogs()} className="btn-brand">
            Apply
          </button>
        </div>
      </SectionCard>

      <SectionCard sectionLabel="Request logs">
        <div className="overflow-x-auto scrollbar-thin">
          {logs.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">
              No audit logs match the filters. Try a different date range or clear filters.
            </div>
          ) : (
            <>
              <table className="w-full table-header-brand">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap">Time</th>
                    <th className="whitespace-nowrap">User</th>
                    <th className="whitespace-nowrap w-20">Method</th>
                    <th className="min-w-[140px]">Summary</th>
                    <th className="min-w-[200px]">Path / Request</th>
                    <th className="whitespace-nowrap w-24">Source</th>
                    <th className="whitespace-nowrap w-16">Status</th>
                    <th className="whitespace-nowrap w-28">IP</th>
                    <th className="min-w-[180px]">User agent</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {log.user ? (
                          <div>
                            <span className="font-medium text-slate-900">{log.user.name}</span>
                            <span className="block text-xs text-slate-500">{log.user.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Guest / Unauthenticated</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded px-2 py-0.5 text-xs font-semibold bg-slate-200 text-slate-800">
                          {log.method}
                        </span>
                      </td>
                      <td className="max-w-[160px] px-4 py-3 text-sm text-slate-800" title={summarizeOperation(log.path, log.method)}>
                        {summarizeOperation(log.path, log.method)}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 font-mono text-sm text-slate-700" title={log.full_url || log.path}>
                        {log.path}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            log.source === 'mobile'
                              ? 'bg-blue-100 text-blue-800'
                              : log.source === 'web'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {log.source === 'mobile' ? 'Mobile' : log.source === 'web' ? 'Web' : log.source}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.response_status != null ? (
                          <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${statusColor(log.response_status)}`}>
                            {log.response_status}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 font-mono">
                        {log.ip_address ?? '—'}
                      </td>
                      <td className="max-w-[220px] px-4 py-3 text-xs text-slate-500" title={log.user_agent ?? undefined}>
                        {truncate(log.user_agent, 50)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-4 py-3">
                <p className="text-sm text-slate-600">
                  Showing {logs.length} of {total} log{total !== 1 ? 's' : ''}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="btn-pagination disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= lastPage}
                    onClick={() => setPage((p) => p + 1)}
                    className="btn-pagination disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
