import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type CheckinItem, type CheckinsResponse, type DailyEmployeeStatusItem, type DailyStatusResponse } from '@/services/api';
import { FormModal } from '@/components/FormModal';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

type Preset = 'today' | 'week' | 'month' | 'year' | 'custom' | 'date';

/** Format as YYYY-MM-DD in local time (not UTC) so "Today" matches server date when timezones align. */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getRange(preset: Preset, singleDate?: string): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (preset === 'today' || (preset === 'date' && singleDate)) {
    const d = singleDate ? new Date(singleDate) : today;
    const from = formatDate(d);
    return { from, to: from };
  }
  if (preset === 'week') {
    const day = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    return { from: formatDate(start), to: formatDate(today) };
  }
  if (preset === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: formatDate(start), to: formatDate(today) };
  }
  if (preset === 'year') {
    const start = new Date(today.getFullYear(), 0, 1);
    return { from: formatDate(start), to: formatDate(today) };
  }
  return { from: formatDate(today), to: formatDate(today) };
}

function formatDisplayDate(s: string): string {
  const [y, m, d] = s.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function downloadCheckinsCsv(
  checkins: CheckinItem[],
  from: string,
  to: string,
  presetLabel: string,
  summary?: { total: number; office: number; event: number }
) {
  const periodLabel = from === to ? from : `${from} to ${to}`;
  const summaryRows: string[] =
    summary != null
      ? [
          ['Report period', periodLabel].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','),
          ['Total check-ins', String(summary.total)].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','),
          ['Office check-ins', String(summary.office)].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','),
          ['Event check-ins', String(summary.event)].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','),
          '',
        ]
      : [];
  const headers = ['Date', 'Check-in', 'Checkout', 'User', 'Type', 'Event', 'Location'];
  const dataRows = checkins.map((c) => [
    c.date,
    c.checkin_time,
    c.checkout_time ?? '—',
    c.user_name,
    c.type === 'office' ? 'Office' : 'Event',
    c.event_name ?? '—',
    c.location,
  ]);
  const csv = [
    ...summaryRows,
    headers.join(','),
    ...dataRows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `checkins-report-${from}-to-${to}-${presetLabel.replace(/\s+/g, '-')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

const OFFICE_COLOR = 'bg-blue-100 text-blue-800 border-blue-200';
const EVENT_COLOR = 'bg-emerald-100 text-emerald-800 border-emerald-200';

export default function Checkins() {
  const today = formatDate(new Date());
  const [serverToday, setServerToday] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>('today');
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [singleDate, setSingleDate] = useState(today);
  const [data, setData] = useState<CheckinsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyStatus, setDailyStatus] = useState<DailyStatusResponse | null>(null);
  const [dailyStatusLoading, setDailyStatusLoading] = useState(false);
  const [employeesTableDate, setEmployeesTableDate] = useState(today);
  const [updatingOffUserId, setUpdatingOffUserId] = useState<number | null>(null);
  const [markOnError, setMarkOnError] = useState<string | null>(null);
  const [markOnErrorUserId, setMarkOnErrorUserId] = useState<number | null>(null);
  const [markOnErrorUserName, setMarkOnErrorUserName] = useState<string | null>(null);
  const [sendingPushUserId, setSendingPushUserId] = useState<number | null>(null);
  const [pushMessage, setPushMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const navigate = useNavigate();

  const effectiveToday = serverToday ?? today;
  const fromTo =
    preset === 'custom'
      ? { from: customFrom, to: customTo }
      : preset === 'today'
        ? { from: effectiveToday, to: effectiveToday }
        : getRange(preset, preset === 'date' ? singleDate : undefined);
  const params =
    preset === 'today'
      ? (serverToday ? { date: serverToday } : ({} as { date?: string; from?: string; to?: string }))
      : fromTo.from === fromTo.to
        ? { date: fromTo.from }
        : { from: fromTo.from, to: fromTo.to };

  const employeesTableEffectiveDate = preset === 'today' ? effectiveToday : employeesTableDate;

  const fetchCheckins = useCallback(() => {
    setLoading(true);
    setError(null);
    api.checkins
      .list(params)
      .then((data) => {
        setData(data);
        if (preset === 'today' && data?.summary?.from && !serverToday) {
          const dateUsed = data.summary.from.slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateUsed)) {
            setServerToday(dateUsed);
            setSingleDate(dateUsed);
            setEmployeesTableDate(dateUsed);
          }
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load check-ins');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [preset, fromTo.from, fromTo.to]);

  const fetchDailyStatus = useCallback(() => {
    setDailyStatusLoading(true);
    api.checkins
      .dailyStatus(employeesTableEffectiveDate)
      .then(setDailyStatus)
      .catch(() => setDailyStatus(null))
      .finally(() => setDailyStatusLoading(false));
  }, [employeesTableEffectiveDate]);

  const setEmployeeOff = useCallback(
    async (userId: number, off: boolean) => {
      setUpdatingOffUserId(userId);
      setMarkOnError(null);
      try {
        await api.checkins.setEmployeeOff(userId, employeesTableEffectiveDate, off);
        await fetchDailyStatus();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update.';
        setMarkOnError(msg);
        if (!off) {
          setMarkOnErrorUserId(userId);
          setMarkOnErrorUserName(dailyStatus?.employees.find((e) => e.user_id === userId)?.user_name ?? null);
        } else {
          setMarkOnErrorUserId(null);
          setMarkOnErrorUserName(null);
        }
      } finally {
        setUpdatingOffUserId(null);
      }
    },
    [employeesTableEffectiveDate, fetchDailyStatus, dailyStatus]
  );

  const sendPushToUser = useCallback(async (userId: number, userName: string) => {
    setSendingPushUserId(userId);
    setPushMessage(null);
    try {
      await api.checkins.sendPush(userId, 'Stagepass', `Hi ${userName}, please check in when you're ready.`);
      setPushMessage({ type: 'success', text: 'Push notification sent.' });
    } catch (err) {
      setPushMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to send push notification.',
      });
    } finally {
      setSendingPushUserId(null);
    }
  }, []);

  const goToTimeOff = () => {
    setMarkOnError(null);
    setMarkOnErrorUserId(null);
    navigate('/time-off');
  };

  const goToCrewTimeOff = (userId: number) => {
    setMarkOnError(null);
    setMarkOnErrorUserId(null);
    navigate(`/time-off/crew/${userId}`);
  };

  useEffect(() => {
    api.checkins
      .serverDate()
      .then((res) => {
        setServerToday(res.date);
        setSingleDate(res.date);
        setEmployeesTableDate(res.date);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchCheckins();
  }, [fetchCheckins]);

  useEffect(() => {
    fetchDailyStatus();
  }, [fetchDailyStatus]);

  const presetExportLabel =
    preset === 'today' ? 'today' : preset === 'date' ? 'date' : preset === 'week' ? 'weekly' : preset === 'month' ? 'monthly' : preset === 'year' ? 'yearly' : 'custom';

  const handleExportReport = () => {
    const checkins = data?.checkins ?? [];
    const summary = data?.summary;
    downloadCheckinsCsv(checkins, fromTo.from, fromTo.to, presetExportLabel, summary);
  };

  const presetLabel =
    preset === 'today' ? 'Today' : preset === 'week' ? 'This week' : preset === 'month' ? 'This month' : preset === 'year' ? 'This year' : preset === 'date' ? 'Particular date' : 'Custom range';

  if (loading && !data) {
    return <Preloader message="Loading check-ins…" fullScreen />;
  }

  const checkins = data?.checkins ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily check-ins"
        subtitle="View office and event check-ins. Filter by date range or generate a report (weekly, monthly, yearly or for a particular date)."
      />

      <SectionCard sectionLabel="Period">
        <div className="flex flex-wrap items-end gap-4 p-6">
          <div className="flex flex-wrap gap-2">
            {(['today', 'week', 'month', 'year', 'date', 'custom'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  preset === p
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {p === 'today' ? 'Today' : p === 'week' ? 'This week' : p === 'month' ? 'This month' : p === 'year' ? 'This year' : p === 'date' ? 'Particular date' : 'Custom'}
              </button>
            ))}
          </div>
          {preset === 'date' && (
            <div className="form-field">
              <label className="form-label" htmlFor="checkin-single-date">
                Date
              </label>
              <input
                id="checkin-single-date"
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                className="form-input w-auto min-w-[10rem]"
              />
            </div>
          )}
          {preset === 'custom' && (
            <>
              <div className="form-field">
                <label className="form-label" htmlFor="checkin-from">
                  From
                </label>
                <input
                  id="checkin-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="form-input w-auto min-w-[10rem]"
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="checkin-to">
                  To
                </label>
                <input
                  id="checkin-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="form-input w-auto min-w-[10rem]"
                />
              </div>
            </>
          )}
          <button type="button" onClick={fetchCheckins} disabled={loading} className="btn-brand disabled:opacity-50">
            {loading ? 'Loading…' : 'Apply'}
          </button>
          <button
            type="button"
            onClick={handleExportReport}
            disabled={loading || !data}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            title={`Download check-ins report (CSV) for ${fromTo.from === fromTo.to ? formatDisplayDate(fromTo.from) : `${formatDisplayDate(fromTo.from)} – ${formatDisplayDate(fromTo.to)}`}`}
          >
            Export report (CSV)
          </button>
        </div>
      </SectionCard>

      {error && <div className="form-error-banner">{error}</div>}

      <SectionCard sectionLabel="Employees – daily check-in status">
        <div className="flex flex-wrap items-end gap-4 border-b border-slate-200 bg-slate-50/50 px-6 py-4">
          <div className="form-field">
            <label className="form-label" htmlFor="employees-table-date">
              Date
            </label>
            <input
              id="employees-table-date"
              type="date"
              value={employeesTableEffectiveDate}
              onChange={(e) => setEmployeesTableDate(e.target.value)}
              className="form-input w-auto min-w-[10rem]"
            />
          </div>
          <button
            type="button"
            onClick={fetchDailyStatus}
            disabled={dailyStatusLoading}
            className="btn-brand disabled:opacity-50"
          >
            {dailyStatusLoading ? 'Loading…' : 'Apply'}
          </button>
        </div>
        {pushMessage && (
          <div
            className={`mx-6 mb-2 rounded border px-4 py-2 text-sm ${
              pushMessage.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {pushMessage.text}
          </div>
        )}
        {dailyStatusLoading && !dailyStatus ? (
          <div className="p-8 text-center text-slate-500">Loading employees…</div>
        ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-6 py-3 font-semibold text-slate-700">Employee</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Expected to report</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Off</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Check-in status</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Check-in time</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Set off/on</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Notify</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyStatus?.employees.length === 0 && !dailyStatusLoading && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                        No employees found.
                      </td>
                    </tr>
                  )}
                  {dailyStatus?.employees.map((emp: DailyEmployeeStatusItem) => (
                    <tr
                      key={emp.user_id}
                      className={`border-b border-slate-100 hover:bg-slate-50/50 ${emp.is_off ? 'bg-amber-50/40' : ''}`}
                    >
                      <td className="px-6 py-3">
                        <span className="font-medium text-slate-900">{emp.user_name}</span>
                        {emp.user_email && (
                          <span className="block text-xs text-slate-500">{emp.user_email}</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            emp.expected_to_report
                              ? 'bg-sky-100 text-sky-800 border-sky-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {emp.expected_to_report ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {emp.is_off ? (
                          <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                            Off
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {emp.is_off ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                              emp.checked_out
                                ? 'bg-slate-100 text-slate-700 border-slate-300'
                                : emp.checked_in
                                  ? OFFICE_COLOR
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {emp.checked_out ? 'Checked out' : emp.checked_in ? 'Checked in' : 'Not checked in'}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-slate-700">
                        {emp.is_off
                          ? '—'
                          : emp.checked_in && emp.checkin_time
                            ? emp.checkout_time
                              ? `${emp.checkin_time} – ${emp.checkout_time}`
                              : emp.checkin_time
                            : '—'}
                      </td>
                      <td className="px-6 py-3">
                        <button
                          type="button"
                          onClick={() => setEmployeeOff(emp.user_id, !emp.is_off)}
                          disabled={updatingOffUserId === emp.user_id}
                          className={`rounded border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                            emp.is_off
                              ? 'border-sky-300 bg-sky-100 text-sky-800 hover:bg-sky-200'
                              : 'border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200'
                          }`}
                        >
                          {updatingOffUserId === emp.user_id
                            ? 'Updating…'
                            : emp.is_off
                              ? 'Mark on'
                              : 'Mark off'}
                        </button>
                      </td>
                      <td className="px-6 py-3">
                        <button
                          type="button"
                          onClick={() => sendPushToUser(emp.user_id, emp.user_name)}
                          disabled={sendingPushUserId === emp.user_id}
                          className="rounded border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                          title="Send push notification to this user's mobile app"
                        >
                          {sendingPushUserId === emp.user_id ? 'Sending…' : 'Send push'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        )}
      </SectionCard>

      {summary && (
        <SectionCard sectionLabel="Summary">
          <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total check-ins</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-blue-700">Office check-ins</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">{summary.office}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-700">Event check-ins</p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{summary.event}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Period</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {fromTo.from === fromTo.to ? formatDisplayDate(fromTo.from) : `${formatDisplayDate(fromTo.from)} – ${formatDisplayDate(fromTo.to)}`}
              </p>
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard sectionLabel="Check-ins list">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/50 px-6 py-3">
          <p className="text-sm text-slate-600">
            {checkins.length} check-in{checkins.length !== 1 ? 's' : ''} in period
          </p>
          <button
            type="button"
            onClick={handleExportReport}
            disabled={!data}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            Download report (CSV)
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-6 py-3 font-semibold text-slate-700">Date</th>
                <th className="px-6 py-3 font-semibold text-slate-700">Check-in</th>
                <th className="px-6 py-3 font-semibold text-slate-700">Checkout</th>
                <th className="px-6 py-3 font-semibold text-slate-700">User</th>
                <th className="px-6 py-3 font-semibold text-slate-700">Type</th>
                <th className="px-6 py-3 font-semibold text-slate-700">Event</th>
                <th className="px-6 py-3 font-semibold text-slate-700">Location</th>
              </tr>
            </thead>
            <tbody>
              {checkins.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No check-ins for the selected period.
                  </td>
                </tr>
              )}
              {checkins.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="whitespace-nowrap px-6 py-3 text-slate-900">{formatDisplayDate(c.date)}</td>
                  <td className="whitespace-nowrap px-6 py-3 text-slate-700">{c.checkin_time}</td>
                  <td className="whitespace-nowrap px-6 py-3 text-slate-700">{c.checkout_time ?? '—'}</td>
                  <td className="px-6 py-3">
                    <span className="font-medium text-slate-900">{c.user_name}</span>
                    {c.user_email && <span className="block text-xs text-slate-500">{c.user_email}</span>}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        c.type === 'office' ? OFFICE_COLOR : EVENT_COLOR
                      }`}
                    >
                      {c.type === 'office' ? 'Office' : 'Event'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-700">{c.event_name ?? '—'}</td>
                  <td className="px-6 py-3 text-slate-600">{c.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {markOnError && (
        <FormModal title="Cannot mark on" onClose={() => { setMarkOnError(null); setMarkOnErrorUserId(null); setMarkOnErrorUserName(null); }} wide={false}>
          <div className="px-6 py-4">
            <p className="text-slate-700">{markOnError}</p>
            {markOnErrorUserId != null && markOnErrorUserName && (
              <p className="mt-2 text-sm font-medium text-slate-800">
                Employee: <strong>{markOnErrorUserName}</strong>
                {markOnErrorUserId != null && (
                  <span className="ml-1 font-normal text-slate-500">(ID: {markOnErrorUserId})</span>
                )}
              </p>
            )}
            <p className="mt-3 text-sm text-slate-600">
              To free this day: open <strong>this employee&apos;s</strong> off dates (use the button below) and either <strong>edit the dates</strong> so this day is no longer covered, or <strong>cancel the time off</strong>. If you see &quot;0 entries&quot;, you may be on another employee&apos;s page—use the button below to go to the correct one.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => { setMarkOnError(null); setMarkOnErrorUserId(null); setMarkOnErrorUserName(null); }} className="btn-secondary">
                Dismiss
              </button>
              <button type="button" onClick={goToTimeOff} className="btn-secondary">
                Time off (all)
              </button>
              {markOnErrorUserId != null && (
                <button type="button" onClick={() => goToCrewTimeOff(markOnErrorUserId)} className="btn-brand">
                  Open {markOnErrorUserName ? `${markOnErrorUserName}'s` : 'this employee\'s'} off dates
                </button>
              )}
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
}
