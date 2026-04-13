import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Event, type Paginated, type PaymentItem } from '@/services/api';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

function todayLocalYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

export default function Allowances() {
  const [events, setEvents] = useState<Event[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError('Could not load allowances data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayLocalYmd();
  const todayEvents = useMemo(
    () => events.filter((e) => eventDateOnly(e) === today).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
    [events, today]
  );

  if (loading && events.length === 0 && payments.length === 0) {
    return <Preloader message="Loading allowances…" fullScreen />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Allowances"
        subtitle="Per-event daily rates for crew and approved allowance payments (mirrors the mobile Allowances view)."
      />

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <SectionCard sectionLabel={`Events today (${today})`}>
        <p className="mb-4 text-sm text-slate-600">
          Daily allowance is set on each event. Crew see today&apos;s rate in the app.{' '}
          <Link to="/events" className="link-brand font-medium">
            Open Events
          </Link>{' '}
          to edit an event.
        </p>
        {todayEvents.length === 0 ? (
          <p className="py-8 text-center text-sm text-brand-600">No events scheduled for today.</p>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full table-header-brand">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Status</th>
                  <th className="text-right">Daily allowance (KES)</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {todayEvents.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                    <td className="px-6 py-4 font-medium text-slate-900">{e.name}</td>
                    <td className="px-6 py-4 text-sm capitalize text-slate-600">{e.status ?? '—'}</td>
                    <td className="px-6 py-4 text-right text-slate-700">
                      {e.daily_allowance != null ? formatMoney(Number(e.daily_allowance)) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/events/${e.id}`} className="link-brand text-sm font-medium">
                        Event details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard sectionLabel="Approved allowance payments">
        <p className="mb-4 text-sm text-slate-600">
          Payments approved in{' '}
          <Link to="/payments" className="link-brand font-medium">
            Payments
          </Link>
          . Use this list to verify allowances and per diem paid to crew.
        </p>
        {payments.length === 0 ? (
          <p className="py-8 text-center text-sm text-brand-600">No approved payments yet.</p>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full table-header-brand">
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
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                    <td className="px-6 py-4 text-sm text-slate-700">{formatPayDate(p.payment_date)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{p.user?.name ?? `#${p.user_id}`}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{p.event?.name ?? `Event #${p.event_id}`}</td>
                    <td className="px-6 py-4 text-sm capitalize text-slate-600">{p.purpose ?? '—'}</td>
                    <td className="px-6 py-4 text-right text-slate-700">{Number(p.per_diem).toFixed(2)}</td>
                    <td className="px-6 py-4 text-right text-slate-700">{Number(p.allowances).toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">{Number(p.total_amount).toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/events/${p.event_id}`} className="link-brand text-sm font-medium">
                        Event
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
