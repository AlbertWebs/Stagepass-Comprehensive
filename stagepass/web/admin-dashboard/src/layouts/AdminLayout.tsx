import { useState, useRef, useEffect } from 'react';
import type { ComponentType } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/** Sidebar: section headers (label only) or links (to, label, icon) */
const nav: Array<
  | { type: 'section'; label: string }
  | { type: 'link'; to: string; label: string; icon: ComponentType<{ className?: string }> }
> = [
  { type: 'link', to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { type: 'section', label: 'Event Management' },
  { type: 'link', to: '/events', label: 'Events', icon: EventsIcon },
  { type: 'section', label: 'Crew Management' },
  { type: 'link', to: '/crew', label: 'Crew', icon: CrewIcon },
  { type: 'section', label: 'Event Operations' },
  { type: 'link', to: '/event-operations', label: 'Event Operations', icon: EventOperationsIcon },
  { type: 'link', to: '/tasks', label: 'Task Management', icon: TasksIcon },
  { type: 'section', label: 'Logistics' },
  { type: 'link', to: '/equipment', label: 'Equipment', icon: EquipmentIcon },
  { type: 'link', to: '/transport', label: 'Transport & Logistics', icon: TransportIcon },
  { type: 'section', label: 'Financials' },
  { type: 'link', to: '/payments', label: 'Payments', icon: PaymentsIcon },
  { type: 'section', label: 'Clients' },
  { type: 'link', to: '/clients', label: 'Clients', icon: ClientsIcon },
  { type: 'section', label: 'Reports & Analytics' },
  { type: 'link', to: '/reports', label: 'Reports', icon: ReportsIcon },
  { type: 'section', label: 'Communication' },
  { type: 'link', to: '/communication', label: 'Communication', icon: CommunicationIcon },
  { type: 'section', label: 'System Control' },
  { type: 'link', to: '/approvals', label: 'Approvals', icon: ApprovalsIcon },
  { type: 'link', to: '/users', label: 'Users & Permissions', icon: UsersIcon },
  { type: 'link', to: '/settings', label: 'System Settings', icon: SettingsIcon },
  { type: 'section', label: 'Support & System' },
  { type: 'link', to: '/audit-logs', label: 'Audit Logs', icon: AuditLogsIcon },
  { type: 'link', to: '/help', label: 'Help & Documentation', icon: HelpIcon },
];

const pathToTitle: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/events': 'Events',
  '/crew': 'Crew',
  '/event-operations': 'Event Operations',
  '/tasks': 'Task Management',
  '/equipment': 'Equipment',
  '/transport': 'Transport & Logistics',
  '/payments': 'Payments',
  '/clients': 'Clients',
  '/reports': 'Reports',
  '/communication': 'Communication',
  '/approvals': 'Approvals',
  '/users': 'Users & Permissions',
  '/profile': 'Profile',
  '/settings': 'System Settings',
  '/backup': 'Backup',
  '/audit-logs': 'Audit Logs',
  '/help': 'Help & Documentation',
  '/time-off': 'Time off',
  '/more': 'More',
};

function getPageTitle(pathname: string): string {
  if (pathToTitle[pathname]) return pathToTitle[pathname];
  if (pathname.startsWith('/events/')) return 'Event details';
  return 'Stagepass Admin';
}

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function EventsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function EquipmentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}
function PaymentsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2m-4-1V9a2 2 0 012-2h2a2 2 0 012 2v1m-4 1a2 2 0 01-2 2h-2a2 2 0 01-2-2" />
    </svg>
  );
}
function ReportsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function CrewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
function EventOperationsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}
function TasksIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}
function TransportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}
function ClientsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function CommunicationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}
function ApprovalsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function AuditLogsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function HelpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function TimeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function BackupIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}
function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  );
}
function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1z" />
    </svg>
  );
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClickOutside: () => void) {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClickOutside();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ref, onClickOutside]);
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const pageTitle = getPageTitle(location.pathname);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(userMenuRef, () => setUserMenuOpen(false));

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-50/80">
      {/* Sidebar - explicit brand navy for reliable contrast */}
      <aside
        className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col shadow-lg"
        style={{ backgroundColor: '#0f1838' }}
      >
        <div className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-white/15 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ca8a04]">
            <span className="text-lg font-bold text-white">S</span>
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">Stagepass</span>
            <span
              className="ml-2 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{ backgroundColor: 'rgba(202,138,4,0.35)', color: '#fef9e7' }}
            >
              Admin
            </span>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto scrollbar-thin px-3 py-4">
          {nav.map((item, idx) => {
            if (item.type === 'section') {
              const linksInSection = nav.slice(idx + 1).findIndex((i) => i.type === 'section');
              const count = linksInSection === -1 ? nav.length - idx - 1 : linksInSection;
              if (count <= 1) return null;
              return (
                <div
                  key={`section-${idx}`}
                  className={`mb-1.5 px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#94a3c2] ${idx > 0 ? 'mt-4' : 'mt-2'}`}
                >
                  {item.label}
                </div>
              );
            }
            const { to, label, icon: Icon } = item;
            const isActive =
              location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[#ca8a04] text-white shadow-inner'
                    : 'text-[#b3c1e1] hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0 opacity-90" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex-shrink-0 border-t border-white/15 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: '#ca8a04' }}
            >
              {(user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.name ?? 'User'}</p>
              <p className="truncate text-xs text-[#94a3c2]">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 py-2.5 text-sm font-medium text-[#b3c1e1] transition hover:bg-white/20 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1z" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="ml-64 flex min-h-screen flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-8 backdrop-blur-sm shadow-header">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{pageTitle}</h1>
          <div className="relative flex items-center" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full outline-none ring-0 transition hover:opacity-90 focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
              aria-label="User menu"
            >
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: '#ca8a04' }}
              >
                {(user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()}
              </div>
            </button>
            {userMenuOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-xl border border-slate-200/80 bg-white py-1 shadow-lg"
                role="menu"
              >
                <div className="border-b border-slate-100 px-4 py-2.5">
                  <p className="truncate text-sm font-medium text-slate-900">{user?.name ?? 'User'}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                </div>
                <Link
                  to="/profile"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <ProfileIcon className="h-4 w-4 text-slate-400" />
                  Profile
                </Link>
                <Link
                  to="/settings"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <SettingsIcon className="h-4 w-4 text-slate-400" />
                  Settings
                </Link>
                <Link
                  to="/backup"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <BackupIcon className="h-4 w-4 text-slate-400" />
                  Backup
                </Link>
                <Link
                  to="/more"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <MoreIcon className="h-4 w-4 text-slate-400" />
                  More
                </Link>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
                >
                  <LogoutIcon className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
