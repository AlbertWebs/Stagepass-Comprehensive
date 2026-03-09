import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Preloader } from '@/components/Preloader';
import { api, type Event, type Paginated } from '@/services/api';

const today = () => new Date().toISOString().slice(0, 10);
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

export default function Dashboard() {
  const { user } = useAuth();
  const [allEvents, setAllEvents] = useState<Paginated<Event> | null>(null);
  const [activeEvents, setActiveEvents] = useState<Event[]>([]);
  const [createdEvents, setCreatedEvents] = useState<Event[]>([]);
  const [usersCount, setUsersCount] = useState<number | null>(null);
  const [equipmentTotal, setEquipmentTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const todayStr = today();
    setLoading(true);
    Promise.all([
      api.events.list({ per_page: 50 }),
      api.events.list({ status: 'active' }),
      api.events.list({ status: 'created' }),
      api.users.list({}),
      api.equipment.list({}),
    ])
      .then(([all, active, created, users, equipment]) => {
        setAllEvents(all);
        setActiveEvents(active.data ?? []);
        setCreatedEvents(
          (created.data ?? [])
            .filter((e) => e.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date))
        );
        setUsersCount(users.total);
        setEquipmentTotal(equipment.total ?? (equipment.data?.length ?? 0));
      })
      .catch(() => {
        setAllEvents({ data: [], current_page: 1, last_page: 1, per_page: 20, total: 0 });
        setActiveEvents([]);
        setCreatedEvents([]);
        setUsersCount(0);
        setEquipmentTotal(0);
      })
      .finally(() => setLoading(false));
  }, []);

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const recentEvents = (allEvents?.data ?? []).slice(0, 5);
  const totalEvents = allEvents?.total ?? 0;
  const crewOnActive = activeEvents.reduce((sum, e) => sum + (e.crew?.length ?? 0), 0);
  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="dashboard-stat-card h-40 animate-pulse p-6" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
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
          </div>
        )}
      </section>

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
                  <ChevronRightIcon className="ml-auto h-4 w-4 flex-shrink-0 opacity-60" style={{ color: BRAND['600'] }} />
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </section>
    </div>
  );
}
