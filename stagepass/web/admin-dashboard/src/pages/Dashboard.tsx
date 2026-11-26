import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Preloader } from '@/components/Preloader';
import { api, type AdminDashboardSummary, type Event, type Paginated } from '@/services/api';
import { isSuperAdministrator } from '@/utils/permissions';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const formatDate = (d: string) => {
  const [y, m, day] = d.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(day));
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/* StagePass brand theme – stagepass.co.ke / Creative Solutions | Technical Excellence */
const BRAND = {
  primary: '#172455',
  '800': '#1e2d5c',
  '950': '#0f1838',
  '50': '#eef1f9',
  '100': '#d9e0f0',
  '200': '#b3c1e1',
  '600': '#3a5092',
  '700': '#2f4178',
  accent: '#ca8a04',
  accentDark: '#a16204',
} as const;

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function SparkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}
function ClipboardCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}
function CpuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function EventTable({
  events,
  showCrew,
  emptyMessage,
  emptyAction,
}: {
  events: Event[];
  showCrew?: boolean;
  emptyMessage: string;
  emptyAction?: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      {events.length > 0 ? (
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-xs font-semibold uppercase tracking-wider" style={{ backgroundColor: BRAND['50'], color: BRAND['700'] }}>
              <th className="px-6 py-4">Event</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Location</th>
              {showCrew && <th className="w-16 px-6 py-4 text-center">Crew</th>}
              <th className="px-6 py-4">Status</th>
              <th className="w-24 px-6 py-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.map((e) => (
              <tr key={e.id} className="group transition-colors duration-150 hover:bg-slate-50/90">
                <td className="px-6 py-4">
                  <span className="font-medium text-slate-900">{e.name}</span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{formatDate(e.date)}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{e.location_name ?? '—'}</td>
                {showCrew && (
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full text-xs font-semibold shadow-sm" style={{ backgroundColor: BRAND['100'], color: BRAND['700'] }}>
                      {e.crew?.length ?? 0}
                    </span>
                  </td>
                )}
                <td className="px-6 py-4">
                  <span
                    className="inline-flex rounded-full px-3 py-1 text-xs font-semibold shadow-sm"
                    style={
                      e.status === 'active'
                        ? { backgroundColor: '#dcfce7', color: '#166534' }
                        : e.status === 'created'
                          ? { backgroundColor: BRAND['100'], color: BRAND['800'] }
                          : { backgroundColor: BRAND['50'], color: BRAND['600'] }
                    }
                  >
                    {e.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <Link
                    to={`/events/${e.id}`}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition hover:opacity-90"
                    style={{ color: BRAND.primary, backgroundColor: 'rgba(202, 138, 4, 0.1)' }}
                  >
                    View
                    <ChevronRightIcon className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <p className="text-sm font-medium" style={{ color: BRAND['600'] }}>{emptyMessage}</p>
          {emptyAction && <div className="mt-4">{emptyAction}</div>}
        </div>
      )}
    </div>
  );
}

function StatCard({
  to,
  label,
  value,
  icon: Icon,
  iconStyle,
}: {
  to?: string;
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  iconStyle?: React.CSSProperties;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm"
          style={iconStyle}
        >
          <Icon className="h-6 w-6" />
        </div>
        {to && (
          <span className="text-xs font-semibold transition group-hover:opacity-90" style={{ color: BRAND['600'] }}>
            View →
          </span>
        )}
      </div>
      <p className="mt-5 text-3xl font-bold tabular-nums tracking-tight text-slate-900">{value}</p>
      <p className="mt-1.5 text-sm font-medium" style={{ color: BRAND['600'] }}>{label}</p>
    </>
  );

  const className = 'dashboard-stat-card group flex flex-col p-6';
  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

function SummaryMetrics({ items }: { items: { label: string; value: string | number; detail?: string; to?: string }[] }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map((item) => {
    const content = <><p className="text-sm font-medium text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{item.value}</p>{item.detail && <p className="mt-1 text-xs text-slate-500">{item.detail}</p>}</>;
    return item.to ? <Link key={item.label} to={item.to} className="dashboard-stat-card p-5 transition hover:border-amber-300">{content}</Link> : <div key={item.label} className="dashboard-stat-card p-5">{content}</div>;
  })}</div>;
}

function DashboardAnalytics({ summary }: { summary: AdminDashboardSummary }) {
  const trend = summary.attendance?.trend ?? [];
  const financeTrend = summary.finance?.monthly_trend ?? [];
  return (
    <div className="space-y-5">
      {summary.attendance && <div className="grid gap-5 xl:grid-cols-2">
        <section className="card-elegant min-w-0 p-5">
          <div className="mb-4"><h2 className="font-semibold text-slate-900">Attendance activity</h2><p className="mt-1 text-sm text-slate-500">People with recorded check-ins and check-outs</p></div>
          {trend.some((row) => row.present > 0) ? <div className="h-72" role="img" aria-label="Line chart showing daily check-ins and check-outs"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{ top: 8, right: 12, left: -18, bottom: 2 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip labelFormatter={(value) => `Date ${value}`} /><Legend /><Line type="monotone" dataKey="present" name="Checked in" stroke="#172455" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="checked_out" name="Checked out" stroke="#ca8a04" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div> : <div className="flex h-72 items-center justify-center text-sm text-slate-500">No attendance records for this period.</div>}
        </section>
        <section className="card-elegant min-w-0 p-5">
          <div className="mb-4"><h2 className="font-semibold text-slate-900">Recorded hours</h2><p className="mt-1 text-sm text-slate-500">Completed shift hours and overtime from attendance records</p></div>
          {trend.some((row) => row.working_hours > 0 || row.overtime_hours > 0) ? <div className="h-72" role="img" aria-label="Area chart showing recorded work hours and overtime"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 8, right: 12, left: -18, bottom: 2 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip labelFormatter={(value) => `Date ${value}`} /><Legend /><Area type="monotone" dataKey="working_hours" name="Work hours" stroke="#172455" fill="#172455" fillOpacity={0.12} /><Area type="monotone" dataKey="overtime_hours" name="Overtime" stroke="#ca8a04" fill="#ca8a04" fillOpacity={0.22} /></AreaChart></ResponsiveContainer></div> : <div className="flex h-72 items-center justify-center text-sm text-slate-500">Hours appear after shifts have been checked out.</div>}
        </section>
      </div>}
      {summary.finance && <section className="card-elegant min-w-0 p-5">
        <div className="mb-4"><h2 className="font-semibold text-slate-900">Allowance and payment activity</h2><p className="mt-1 text-sm text-slate-500">KES totals from existing allowance and payout records by month</p></div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(15rem,1fr)]">
          {financeTrend.some((row) => row.allowances || row.approved_payments || row.completed_payouts) ? <div className="h-72" role="img" aria-label="Bar chart of monthly allowances and payments in Kenyan shillings"><ResponsiveContainer width="100%" height="100%"><BarChart data={financeTrend} margin={{ top: 8, right: 12, left: 8, bottom: 2 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="month" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip formatter={(value) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(value))} /><Legend /><Bar dataKey="allowances" name="Allowances recorded" fill="#ca8a04" radius={[4, 4, 0, 0]} /><Bar dataKey="approved_payments" name="Approved payments" fill="#172455" radius={[4, 4, 0, 0]} /><Bar dataKey="completed_payouts" name="Completed payouts" fill="#15803d" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <div className="flex h-72 items-center justify-center text-sm text-slate-500">No allowance or payment records for the last six months.</div>}
          <div className="min-h-64 rounded-xl bg-slate-50/70 p-3"><p className="px-2 text-sm font-medium text-slate-700">Allowance status</p>{[summary.finance.allowances.pending_count, summary.finance.allowances.approved_count, summary.finance.allowances.paid_count, summary.finance.allowances.rejected_count].some(Boolean) ? <div className="h-60" role="img" aria-label="Donut chart showing allowance status distribution"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Pending', value: summary.finance.allowances.pending_count }, { name: 'Approved', value: summary.finance.allowances.approved_count }, { name: 'Paid', value: summary.finance.allowances.paid_count }, { name: 'Rejected', value: summary.finance.allowances.rejected_count }].filter((item) => item.value > 0)} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="78%" paddingAngle={2}>{['#ca8a04', '#172455', '#15803d', '#64748b'].map((color) => <Cell key={color} fill={color} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div> : <div className="flex h-60 items-center justify-center text-sm text-slate-500">No allowance records.</div>}</div>
        </div>
      </section>}
      {summary.tasks && <div className="grid gap-4 sm:grid-cols-2">
        <section className="card-elegant p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">Task completion</p><p className="mt-2 text-2xl font-semibold text-slate-900">{summary.tasks.completion_rate}%</p></div><Link to="/tasks" className="text-sm font-semibold text-brand-700">View tasks</Link></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${summary.tasks.completion_rate}%` }} /></div><p className="mt-2 text-xs text-slate-500">{summary.tasks.completed} of {summary.tasks.total} tasks completed</p></section>
        <section className="card-elegant p-5"><h2 className="font-semibold text-slate-900">Needs attention</h2>{summary.attention.length ? <ul className="mt-2 divide-y divide-slate-100">{summary.attention.map((item) => <li key={item.type} className="py-2"><Link to={item.href} className="flex items-center justify-between gap-3 text-sm hover:text-brand-700"><span>{item.label}</span><span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">{item.count}</span></Link></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No outstanding items for the current view.</p>}</section>
      </div>}
    </div>
  );
}

function RoleDashboard({ summary, from, to, setFrom, setTo }: {
  summary: AdminDashboardSummary;
  from: string;
  to: string;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
}) {
  const finance = summary.finance;
  const attendance = summary.attendance;
  const kes = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(value || 0);
  const items = summary.role === 'hr' ? [
    { label: 'Active employees & crew', value: summary.workforce.active, to: '/crew' },
    { label: 'Present today', value: attendance?.present_today ?? 0, to: '/checkins' },
    { label: 'Currently checked in', value: attendance?.checked_in_now ?? 0, to: '/checkins' },
    { label: 'Checked out today', value: attendance?.checked_out_today ?? 0, to: '/checkins' },
    { label: 'Missing check-outs', value: attendance?.missing_checkouts_today ?? 0, to: '/checkins' },
    { label: 'Hours recorded today', value: `${(attendance?.working_hours_today ?? 0).toFixed(1)} h` },
    { label: 'Overtime recorded today', value: `${(attendance?.overtime_hours_today ?? 0).toFixed(1)} h` },
    { label: 'Allowances awaiting review', value: finance?.allowances.pending_count ?? 0, to: '/allowances' },
  ] : summary.role === 'team_leader' ? [
    { label: 'Assigned crew', value: summary.workforce.active, to: '/events' },
    { label: 'Upcoming events', value: summary.events?.upcoming ?? 0, to: '/events' },
    { label: 'Ongoing events', value: summary.events?.ongoing ?? 0, to: '/events' },
    { label: 'Open tasks', value: summary.tasks?.pending ?? 0, to: '/tasks' },
    { label: 'Completed tasks', value: summary.tasks?.completed ?? 0, to: '/tasks' },
    { label: 'Task completion', value: `${summary.tasks?.completion_rate ?? 0}%`, to: '/tasks' },
  ] : [
    { label: 'Allowances pending', value: kes(finance?.allowances.pending_total ?? 0), detail: `${finance?.allowances.pending_count ?? 0} records`, to: '/allowances' },
    { label: 'Approved allowances', value: kes(finance?.allowances.approved_total ?? 0), detail: `${finance?.allowances.approved_count ?? 0} records`, to: '/allowances' },
    { label: 'Allowances paid', value: kes(finance?.allowances.paid_total ?? 0), detail: `${finance?.allowances.paid_count ?? 0} records`, to: '/allowances' },
    { label: 'Payments awaiting approval', value: finance?.payments.pending_count ?? 0, to: '/payments' },
    { label: 'Approved payment obligations', value: kes(finance?.payments.approved_total ?? 0), to: '/payments' },
    { label: 'Completed payouts', value: kes(finance?.payouts.completed_total ?? 0), to: '/payments' },
    { label: 'Pending payouts', value: kes(finance?.payouts.pending_total ?? 0), to: '/payments' },
    { label: 'Failed payout batches', value: finance?.payouts.failed_count ?? 0, to: '/payments' },
  ];
  const title = summary.role === 'hr' ? 'Workforce overview' : summary.role === 'team_leader' ? 'Team operations' : 'Finance overview';
  return <div className="space-y-7 pb-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Stagepass · {summary.role === 'hr' ? 'People operations' : summary.role === 'team_leader' ? 'Team leader' : 'Accounts'}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1><p className="mt-1 text-sm text-slate-500">Verified operational records for {summary.period.from} through {summary.period.to}.</p></div>
      <div className="flex flex-wrap items-end gap-3"><label className="text-xs font-medium text-slate-600">From<input aria-label="Dashboard period from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="form-input mt-1 min-w-36 px-3 py-2" /></label><label className="text-xs font-medium text-slate-600">To<input aria-label="Dashboard period to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="form-input mt-1 min-w-36 px-3 py-2" /></label></div>
    </div>
    <SummaryMetrics items={items} />
    <DashboardAnalytics summary={summary} />
    {attendance && summary.role === 'hr' && <section className="card-elegant overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Today’s attendance</h2><p className="mt-1 text-sm text-slate-500">Office and event check-ins. Expected office reporting times are not configured in this system.</p></div><Link to="/checkins" className="text-sm font-semibold text-brand-700">Open attendance records</Link></div>
      <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100 text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Location / event</th><th className="px-4 py-3">Expected</th><th className="px-4 py-3">Check-in</th><th className="px-4 py-3">Check-out</th><th className="px-4 py-3">Hours</th><th className="px-4 py-3">Overtime</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{attendance.daily_rows.length ? attendance.daily_rows.map((row) => <tr key={row.key} className="hover:bg-slate-50/70"><td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{row.employee}</td><td className="px-4 py-3">{row.location}</td><td className="px-4 py-3">{row.expected_time ?? 'Not set'}</td><td className="px-4 py-3">{row.checkin_time ?? '—'}</td><td className="px-4 py-3">{row.checkout_time ?? '—'}</td><td className="px-4 py-3">{row.working_hours == null ? '—' : `${row.working_hours.toFixed(1)} h`}</td><td className="px-4 py-3">{row.overtime_hours == null ? '—' : `${row.overtime_hours.toFixed(1)} h`}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === 'On shift' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{row.status}</span></td></tr>) : <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-500">No attendance recorded today.</td></tr>}</tbody></table></div>
    </section>}
    <section className="card-elegant p-5"><h2 className="font-semibold text-slate-900">Action centre</h2>{summary.attention.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{summary.attention.map((item) => <Link key={item.type} to={item.href} className="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:border-amber-300 hover:bg-amber-50/30"><span className="text-sm font-medium text-slate-700">{item.label}</span><span className="rounded-full bg-amber-100 px-2.5 py-1 text-sm font-semibold text-amber-900">{item.count}</span></Link>)}</div> : <p className="mt-2 text-sm text-slate-500">No items currently require action.</p>}</section>
  </div>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdministrator(user);
  const [allEvents, setAllEvents] = useState<Paginated<Event> | null>(null);
  const [activeEvents, setActiveEvents] = useState<Event[]>([]);
  const [createdEvents, setCreatedEvents] = useState<Event[]>([]);
  const [usersCount, setUsersCount] = useState<number | null>(null);
  const [equipmentTotal, setEquipmentTotal] = useState<number | null>(null);
  const [officeCheckinsToday, setOfficeCheckinsToday] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const [dateTo, setDateTo] = useState(today());
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 13);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  useEffect(() => {
    if (!user) return;
    setSummaryLoading(true);
    setSummaryError('');
    api.dashboard.summary({ from: dateFrom, to: dateTo })
      .then(setSummary)
      .catch((error: unknown) => setSummaryError(error instanceof Error ? error.message : 'Could not load dashboard analytics.'))
      .finally(() => setSummaryLoading(false));
  }, [user?.id, dateFrom, dateTo]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    const todayStr = today();
    setLoading(true);
    Promise.all([
      api.events.list({ per_page: 50 }),
      api.events.list({ status: 'active' }),
      api.events.list({ status: 'created' }),
      api.users.list({}),
      api.equipment.list({}),
      api.checkins.list({ from: todayStr, to: todayStr }),
    ])
      .then(([all, active, created, users, equipment, checkins]) => {
        setAllEvents(all);
        setActiveEvents(active.data ?? []);
        setCreatedEvents(
          (created.data ?? [])
            .filter((e) => e.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date))
        );
        setUsersCount(users.total);
        setEquipmentTotal(equipment.total ?? (equipment.data?.length ?? 0));
        setOfficeCheckinsToday(checkins.summary?.office ?? 0);
      })
      .catch(() => {
        setAllEvents({ data: [], current_page: 1, last_page: 1, per_page: 20, total: 0 });
        setActiveEvents([]);
        setCreatedEvents([]);
        setUsersCount(0);
        setEquipmentTotal(0);
        setOfficeCheckinsToday(0);
      })
      .finally(() => setLoading(false));
  }, [isSuperAdmin]);

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const recentEvents = (allEvents?.data ?? []).slice(0, 5);
  const totalEvents = allEvents?.total ?? 0;
  const crewOnActive = activeEvents.reduce((sum, e) => sum + (e.crew?.length ?? 0), 0);
  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  if (!isSuperAdmin) {
    if (summaryError) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{summaryError}</div>;
    if (summaryLoading || !summary) return <Preloader message="Loading your dashboard…" fullScreen />;
    return <RoleDashboard summary={summary} from={dateFrom} to={dateTo} setFrom={setDateFrom} setTo={setDateTo} />;
  }

  if (loading && allEvents === null) {
    return <Preloader message="Loading dashboard…" fullScreen />;
  }

  return (
    <div className="space-y-10 pb-4" style={{ background: 'linear-gradient(180deg, rgba(248,250,252,0.5) 0%, transparent 12rem)' }}>
      {/* Welcome */}
      <div
        className="relative overflow-hidden rounded-2xl px-8 py-10 shadow-xl"
        style={{
          background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND['800']} 42%, ${BRAND['950']} 100%)`,
          color: '#fff',
          boxShadow: '0 20px 40px -12px rgba(15, 24, 56, 0.35)',
        }}
      >
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20" style={{ background: `radial-gradient(circle, ${BRAND.accent} 0%, transparent 70%)` }} />
        <div className="absolute bottom-0 right-0 h-32 w-64 opacity-10" style={{ background: `linear-gradient(90deg, transparent, ${BRAND.accent})` }} />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: BRAND['200'] }}>
            {todayLabel}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white drop-shadow-sm sm:text-4xl">
            Hello, {firstName}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.92)' }}>
            Here’s your overview of events, crew, and resources. Jump to any section below or use the sidebar.
          </p>
        </div>
      </div>

      {/* Overview */}
      <section>
        <h2 className="dashboard-section-title mb-5">
          At a glance
        </h2>
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="dashboard-stat-card h-40 animate-pulse p-6" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
            <StatCard
              to="/events"
              label="Total events"
              value={totalEvents}
              icon={CalendarIcon}
              iconStyle={{ backgroundColor: BRAND['50'], color: BRAND['800'] }}
            />
            <StatCard
              to="/events"
              label="Ongoing now"
              value={activeEvents.length}
              icon={ClipboardCheckIcon}
              iconStyle={{ backgroundColor: '#fef3c7', color: BRAND.accentDark }}
            />
            <StatCard
              label="Upcoming"
              value={createdEvents.length}
              icon={CalendarIcon}
              iconStyle={{ backgroundColor: BRAND['100'], color: BRAND['700'] }}
            />
            <StatCard
              to="/users"
              label="Team members"
              value={usersCount ?? '—'}
              icon={UsersIcon}
              iconStyle={{ backgroundColor: BRAND['50'], color: BRAND['800'] }}
            />
            <StatCard
              to="/equipment"
              label="Equipment"
              value={equipmentTotal ?? '—'}
              icon={CpuIcon}
              iconStyle={{ backgroundColor: BRAND['100'], color: BRAND['700'] }}
            />
            <StatCard
              to="/checkins"
              label="Office check-ins today"
              value={officeCheckinsToday ?? '—'}
              icon={ClipboardCheckIcon}
              iconStyle={{ backgroundColor: '#ecfdf5', color: '#047857' }}
            />
          </div>
        )}
      </section>

      {summary && <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="dashboard-section-title">Operational analytics</h2><p className="mt-2 text-sm text-slate-500">Recorded attendance and finance activity across the selected period.</p></div><div className="flex gap-3"><label className="text-xs font-medium text-slate-600">From<input type="date" value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)} className="form-input mt-1 px-3 py-2" /></label><label className="text-xs font-medium text-slate-600">To<input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} className="form-input mt-1 px-3 py-2" /></label></div></div>
        <DashboardAnalytics summary={summary} />
      </section>}

      {/* Live crew strip */}
      {!loading && activeEvents.length > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-6 py-5 shadow-sm"
          style={{ backgroundColor: BRAND['50'], borderColor: BRAND['200'], boxShadow: '0 2px 8px -2px rgba(23, 36, 85, 0.08)' }}
        >
          <div className="flex items-center gap-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl shadow-sm" style={{ backgroundColor: BRAND['100'], color: BRAND['700'] }}>
              <UsersIcon className="h-6 w-6" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" title="Live" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Crew on active events</p>
              <p className="mt-0.5 text-sm" style={{ color: BRAND['600'] }}>
                {crewOnActive} {crewOnActive === 1 ? 'person' : 'people'} across {activeEvents.length} event{activeEvents.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Link
            to="/events"
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
            style={{ color: BRAND.primary, backgroundColor: 'rgba(202, 138, 4, 0.14)' }}
          >
            View ongoing
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Ongoing & Upcoming */}
      <section>
        <h2 className="dashboard-section-title mb-5">
          Events
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card-elegant overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: BRAND['100'], backgroundColor: 'rgba(238, 241, 249, 0.6)' }}>
              <h3 className="font-semibold text-slate-800">Ongoing</h3>
              <Link
                to="/events"
                className="text-sm font-semibold transition hover:opacity-90"
                style={{ color: BRAND.primary }}
              >
                View all →
              </Link>
            </div>
            <EventTable
              events={activeEvents.slice(0, 5)}
              showCrew
              emptyMessage="No events in progress right now."
              emptyAction={
                <Link to="/events" className="text-sm font-medium" style={{ color: BRAND.primary }}>
                  Create an event
                </Link>
              }
            />
          </div>
          <div className="card-elegant overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: BRAND['100'], backgroundColor: 'rgba(238, 241, 249, 0.6)' }}>
              <h3 className="font-semibold text-slate-800">Upcoming</h3>
              <Link
                to="/events"
                className="text-sm font-semibold transition hover:opacity-90"
                style={{ color: BRAND.primary }}
              >
                View all →
              </Link>
            </div>
            <EventTable
              events={createdEvents.slice(0, 5)}
              showCrew
              emptyMessage="No upcoming events scheduled."
              emptyAction={
                <Link to="/events" className="text-sm font-medium" style={{ color: BRAND.primary }}>
                  Schedule an event
                </Link>
              }
            />
          </div>
        </div>
      </section>

      {/* Recent + Actions */}
      <section>
        <h2 className="dashboard-section-title mb-5">
          Recent &amp; quick actions
        </h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card-elegant overflow-hidden lg:col-span-2">
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: BRAND['100'], backgroundColor: 'rgba(238, 241, 249, 0.6)' }}>
              <h3 className="font-semibold text-slate-800">Recent events</h3>
              <Link
                to="/events"
                className="text-sm font-semibold transition hover:opacity-90"
                style={{ color: BRAND.primary }}
              >
                View all →
              </Link>
            </div>
            <EventTable
              events={recentEvents}
              emptyMessage="No events yet."
              emptyAction={
                <Link to="/events" className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition" style={{ color: BRAND.primary, backgroundColor: 'rgba(202, 138, 4, 0.12)' }}>
                  <PlusIcon className="h-4 w-4" />
                  Create your first event
                </Link>
              }
            />
          </div>
          <div className="card-elegant overflow-hidden">
            <div className="border-b px-6 py-4" style={{ borderColor: BRAND['100'], backgroundColor: 'rgba(238, 241, 249, 0.6)' }}>
              <h3 className="font-semibold text-slate-800">Quick actions</h3>
              <p className="mt-0.5 text-xs font-medium" style={{ color: BRAND['600'] }}>Shortcuts to common tasks</p>
            </div>
            <nav className="grid gap-0.5 p-4" aria-label="Quick actions">
              {[
                { to: '/events', label: 'Create event', icon: PlusIcon },
                { to: '/users', label: 'Add team member', icon: UsersIcon },
                { to: '/equipment', label: 'Manage equipment', icon: CpuIcon },
                { to: '/payments', label: 'Payments', icon: SparkIcon },
                { to: '/time-off', label: 'Time off requests', icon: CalendarIcon },
              ].map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-amber-200/60 hover:bg-amber-50/70"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl shadow-sm" style={{ backgroundColor: BRAND['50'], color: BRAND['700'] }}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {label}
                  <ChevronRightIcon className="ml-auto h-4 w-4 flex-shrink-0 text-slate-400 opacity-60" />
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </section>
    </div>
  );
}
