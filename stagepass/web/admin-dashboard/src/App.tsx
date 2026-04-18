import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { InstallPrompt } from '@/components/InstallPrompt';
import { Preloader } from '@/components/Preloader';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/layouts/AdminLayout';
import Approvals from '@/pages/Approvals';
import AuditLogs from '@/pages/AuditLogs';
import Clients from '@/pages/Clients';
import Communication from '@/pages/Communication';
import Dashboard from '@/pages/Dashboard';
import Equipment from '@/pages/Equipment';
import EventDetail from '@/pages/EventDetail';
import EventOperations from '@/pages/EventOperations';
import Events from '@/pages/Events';
import Login from '@/pages/Login';
import Payments from '@/pages/Payments';
import Allowances from '@/pages/Allowances';
import Holidays from '@/pages/Holidays';
import Help from '@/pages/Help';
import Placeholder from '@/pages/Placeholder';
import Checkins from '@/pages/Checkins';
import Reports from '@/pages/Reports';
import Transport from '@/pages/Transport';
import Settings from '@/pages/Settings';
import DangerZone from '@/pages/DangerZone';
import Tasks from '@/pages/Tasks';
import CrewMemberTimeOff from '@/pages/CrewMemberTimeOff';
import TimeOff from '@/pages/TimeOff';
import Users from '@/pages/Users';

function getRoleNames(user: { roles?: Array<{ name?: string }> } | null): string[] {
  return (user?.roles ?? [])
    .map((r) => String(r?.name ?? '').trim().toLowerCase())
    .filter(Boolean);
}

function hasAdminAccess(user: { roles?: Array<{ name?: string }> } | null): boolean {
  const names = getRoleNames(user);
  return names.some((n) => n === 'admin' || n === 'super_admin' || n === 'director');
}

function isTeamLeaderOnly(user: { roles?: Array<{ name?: string }> } | null): boolean {
  const names = getRoleNames(user);
  const isTeamLeader = names.includes('team_leader') || names.includes('teamleader');
  const isAdmin = names.some((n) => n === 'admin' || n === 'super_admin' || n === 'director');
  return isTeamLeader && !isAdmin;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) {
    return <Preloader message="Checking session…" />;
  }
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleRoute({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { user } = useAuth();
  if (requireAdmin && !hasAdminAccess(user)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const location = useLocation();
  const { token } = useAuth();
  const showInstallPrompt = !token && location.pathname === '/login';

  return (
    <>
      {showInstallPrompt ? <InstallPrompt /> : null}
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="events" element={<Events />} />
        <Route path="events/:id" element={<EventDetail />} />
        <Route
          path="crew"
          element={
            <Users
              title="Crew"
              subtitle="Manage crew members. Search, create, edit or delete and assign roles."
              sectionLabel="Crew members"
              createButtonLabel="Add crew"
              showPushTestActions
            />
          }
        />
        <Route path="event-operations" element={<EventOperations />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="equipment" element={<RoleRoute requireAdmin><Equipment /></RoleRoute>} />
        <Route path="transport" element={<RoleRoute requireAdmin><Transport /></RoleRoute>} />
        <Route path="payments" element={<RoleRoute requireAdmin><Payments /></RoleRoute>} />
        <Route path="allowances" element={<Allowances />} />
        <Route path="holidays" element={<RoleRoute requireAdmin><Holidays /></RoleRoute>} />
        <Route path="clients" element={<RoleRoute requireAdmin><Clients /></RoleRoute>} />
        <Route path="reports" element={<RoleRoute requireAdmin><Reports /></RoleRoute>} />
        <Route path="checkins" element={<RoleRoute requireAdmin><Checkins /></RoleRoute>} />
        <Route path="communication" element={<Communication />} />
        <Route path="approvals" element={<RoleRoute requireAdmin><Approvals /></RoleRoute>} />
        <Route path="users" element={<RoleRoute requireAdmin><Users title="Users & Permissions" subtitle="Manage users and assign roles. Full access for admins." sectionLabel="Users" createButtonLabel="Create user" /></RoleRoute>} />
        <Route path="settings" element={<RoleRoute requireAdmin><Settings /></RoleRoute>} />
        <Route path="audit-logs" element={<RoleRoute requireAdmin><AuditLogs /></RoleRoute>} />
        <Route path="help" element={<Help />} />
        <Route path="time-off" element={<RoleRoute requireAdmin><TimeOff /></RoleRoute>} />
        <Route path="time-off/crew/:userId" element={<RoleRoute requireAdmin><CrewMemberTimeOff /></RoleRoute>} />
        <Route path="profile" element={<Settings />} />
        <Route path="backup" element={<RoleRoute requireAdmin><Settings /></RoleRoute>} />
        <Route path="danger-zone" element={<RoleRoute requireAdmin><DangerZone /></RoleRoute>} />
        <Route path="more" element={<Placeholder title="More" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
