import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Event, type Paginated, type PaymentItem } from '@/services/api';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';

function todayLocalYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTodayHeading(): string {
  return new Date().toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function eventDateOnly(event: Event): string {
  if (!event.date || typeof event.date !== 'string') return '';
  const s = String(event.date).trim();
  return s.length >= 10 ? s.substring(0, 10) : '';
}

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

function statusBadgeClass(status: string | undefined): string {
  const s = (status ?? '').toLowerCase();
  if (s.includes('done') || s.includes('complete')) return 'bg-indigo-100 text-indigo-800';
  if (s.includes('live') || s.includes('active') || s === 'ongoing') return 'bg-emerald-100 text-emerald-800';
  if (s.includes('plan') || s.includes('draft')) return 'bg-slate-100 text-slate-700';
  if (s.includes('cancel')) return 'bg-red-100 text-red-800';
  return 'bg-amber-50 text-amber-900';
}

function purposeBadgeClass(purpose: string | null | undefined): string {
  const p = (purpose ?? '').toLowerCase();
  if (p === 'transport') return 'bg-sky-100 text-sky-900';
  if (p === 'lunch' || p === 'dinner' || p === 'fair') return 'bg-violet-100 text-violet-900';
  if (p === 'accommodation') return 'bg-teal-100 text-teal-900';
  return 'bg-slate-100 text-slate-700';
}

export default function Allowances() {
  const [events, setEvents] = useState<Event[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventQuery, setEventQuery] = useState('');
  const [paymentQuery, setPaymentQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, payRes] = await Promise.all([
        api.events.list({ per_page: 100 }),
        api.payments.list({ status: 'approved', per_page: 100 }),
      ]);
      const ev = (eventsRes as Paginated<Event>)?.data ?? [];
      const pay = (payRes as Paginated<PaymentItem>)?.data ?? [];
      setEvents(Array.isArray(ev) ? ev : []);
      setPayments(Array.isArray(pay) ? pay : []);
    } catch {
      setEvents([]);
      setPayments([]);
      setError('Could not load allowances data. Check your connection and API settings, then try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = todayLocalYmd();
  const todayEvents = useMemo(
    () => events.filter((e) => eventDateOnly(e) === today).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
    [events, today]
  );

  const filteredTodayEvents = useMemo(() => {
    const q = eventQuery.trim().toLowerCase();
    if (!q) return todayEvents;
    return todayEvents.filter((e) => e.name.toLowerCase().includes(q) || (e.status ?? '').toLowerCase().includes(q));
  }, [todayEvents, eventQuery]);

  const sortedFilteredPayments = useMemo(() => {
    const q = paymentQuery.trim().toLowerCase();
    let list = [...payments];
    list.sort((a, b) => {
      const da = (a.payment_date ?? '').slice(0, 10);
      const db = (b.payment_date ?? '').slice(0, 10);
      return db.localeCompare(da);
    });
    if (!q) return list;
    return list.filter((p) => {
      const crew = (p.user?.name ?? String(p.user_id)).toLowerCase();
      const ev = (p.event?.name ?? String(p.event_id)).toLowerCase();
      const purpose = (p.purpose ?? '').toLowerCase();
      return crew.includes(q) || ev.includes(q) || purpose.includes(q);
    });
  }, [payments, paymentQuery]);

  const stats = useMemo(() => {
    const withAllowance = todayEvents.filter((e) => e.daily_allowance != null && Number(e.daily_allowance) > 0).length;
    const sumAllowances = payments.reduce((s, p) => s + Number(p.allowances ?? 0), 0);
    const sumTotal = payments.reduce((s, p) => s + Number(p.total_amount ?? 0), 0);
    return {
      todayCount: todayEvents.length,
      todayWithRate: withAllowance,
      todayMissingRate: todayEvents.length - withAllowance,
      approvedCount: payments.length,
      sumAllowances,
      sumTotal,
    };
  }, [todayEvents, payments]);

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
      <Link to="/events" className="btn-secondary">
        Events
      </Link>
      <Link to="/payments" className="btn-primary">
        Payments
      </Link>
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Allowances"
        subtitle="Per-event daily rates for crew on today’s calendar, plus approved allowance lines from Payments—use this view to cross-check rates and what was paid."
        action={headerActions}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Events today</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? '…' : stats.todayCount}</p>
          <p className="mt-1 text-xs text-slate-500">{formatTodayHeading()}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Daily rate set</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-950">{loading ? '…' : stats.todayWithRate}</p>
          <p className="mt-1 text-xs text-emerald-800">Of today’s events</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Approved rows</p>
          <p className="mt-2 text-2xl font-semibold text-amber-950">{loading ? '…' : stats.approvedCount}</p>
          <p className="mt-1 text-xs text-amber-800">Up to 100 loaded</p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-800">Allowances total</p>
          <p className="mt-2 text-lg font-semibold text-indigo-950 tabular-nums">{loading ? '…' : formatMoney(stats.sumAllowances)}</p>
          <p className="mt-1 text-xs text-indigo-800">Paid total {loading ? '' : formatMoney(stats.sumTotal)}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <p>{error}</p>
          <button type="button" className="mt-2 text-sm font-medium text-red-900 underline hover:no-underline" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : null}

      <SectionCard sectionLabel={`Today’s events · ${today}`}>
        <div className="p-5 sm:p-6">
          <p className="mb-4 text-sm text-slate-600">
            Daily allowance is stored on each event. Crew see today’s rate in the mobile app.{' '}
            <Link to="/events" className="link-brand font-medium">
              Open Events
            </Link>{' '}
            to edit rates.
          </p>
          {stats.todayMissingRate > 0 && !loading ? (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {stats.todayMissingRate} event{stats.todayMissingRate === 1 ? '' : 's'} today {stats.todayMissingRate === 1 ? 'has' : 'have'} no daily allowance set—consider updating before crew check in.
            </p>
          ) : null}
          <input
            className="input mb-4 w-full max-w-md"
            placeholder="Search today’s events by name or status"
            value={eventQuery}
            onChange={(e) => setEventQuery(e.target.value)}
            disabled={loading && todayEvents.length === 0}
            aria-label="Search today’s events"
          />
          {loading && todayEvents.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading today’s events…</p>
          ) : filteredTodayEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">No events match your filters</p>
              <p className="mt-1 text-sm text-slate-500">
                {todayEvents.length === 0
                  ? 'Nothing scheduled for today, or your search hid all rows.'
                  : 'Try clearing the search box.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin -mx-5 sm:-mx-6">
              <table className="w-full min-w-[640px] table-header-brand">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Status</th>
                    <th className="text-right">Daily allowance</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTodayEvents.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                      <td className="px-6 py-4 font-medium text-slate-900">{e.name}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(e.status)}`}
                        >
                          {e.status ?? '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-700">
                        {e.daily_allowance != null ? formatMoney(Number(e.daily_allowance)) : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link to={`/events/${e.id}`} className="link-brand text-sm font-medium">
                          Event details →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard sectionLabel="Approved allowance payments">
        <div className="p-5 sm:p-6">
          <p className="mb-4 text-sm text-slate-600">
            Rows are approved in{' '}
            <Link to="/payments" className="link-brand font-medium">
              Payments
            </Link>
            . Use this list to verify per diem and allowance amounts paid to crew.
          </p>
          <input
            className="input mb-4 w-full max-w-md"
            placeholder="Search by crew, event, or purpose"
            value={paymentQuery}
            onChange={(e) => setPaymentQuery(e.target.value)}
            disabled={loading && payments.length === 0}
            aria-label="Search approved payments"
          />
          {loading && payments.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading payments…</p>
          ) : sortedFilteredPayments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">No rows to show</p>
              <p className="mt-1 text-sm text-slate-500">
                {payments.length === 0
                  ? 'No approved payments yet, or nothing matched your search.'
                  : 'Adjust your search to see more results.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin -mx-5 sm:-mx-6">
              <table className="w-full min-w-[900px] table-header-brand">
                <thead>
                  <tr>
                    <th>Payment date</th>
                    <th>Crew</th>
                    <th>Event</th>
                    <th>Purpose</th>
                    <th className="text-right">Per diem</th>
                    <th className="text-right">Allowances</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFilteredPayments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                      <td className="px-6 py-4 text-sm text-slate-700">{formatPayDate(p.payment_date)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{p.user?.name ?? `#${p.user_id}`}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{p.event?.name ?? `Event #${p.event_id}`}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${purposeBadgeClass(p.purpose)}`}
                        >
                          {p.purpose ?? '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-700">{formatMoney(Number(p.per_diem))}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-slate-700">{formatMoney(Number(p.allowances))}</td>
                      <td className="px-6 py-4 text-right text-sm font-semibold tabular-nums text-slate-900">
                        {formatMoney(Number(p.total_amount))}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link to={`/events/${p.event_id}`} className="link-brand text-sm font-medium">
                          Event →
                        </Link>
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
