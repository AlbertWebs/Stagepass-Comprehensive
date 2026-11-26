import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { InstallPrompt } from '@/components/InstallPrompt';
import { Preloader } from '@/components/Preloader';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/layouts/AdminLayout';
import { hasPermission, isSuperAdministrator } from '@/utils/permissions';

const Approvals = lazy(() => import('@/pages/Approvals'));
const AuditLogs = lazy(() => import('@/pages/AuditLogs'));
const Clients = lazy(() => import('@/pages/Clients'));
const Communication = lazy(() => import('@/pages/Communication'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Equipment = lazy(() => import('@/pages/Equipment'));
const EventDetail = lazy(() => import('@/pages/EventDetail'));
const EventOperations = lazy(() => import('@/pages/EventOperations'));
const Events = lazy(() => import('@/pages/Events'));
const Login = lazy(() => import('@/pages/Login'));
const Payments = lazy(() => import('@/pages/Payments'));
const Allowances = lazy(() => import('@/pages/Allowances'));
const Holidays = lazy(() => import('@/pages/Holidays'));
const Help = lazy(() => import('@/pages/Help'));
const Placeholder = lazy(() => import('@/pages/Placeholder'));
const Checkins = lazy(() => import('@/pages/Checkins'));
const Reports = lazy(() => import('@/pages/Reports'));
const Transport = lazy(() => import('@/pages/Transport'));
const Settings = lazy(() => import('@/pages/Settings'));
const DangerZone = lazy(() => import('@/pages/DangerZone'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const CrewMemberTimeOff = lazy(() => import('@/pages/CrewMemberTimeOff'));
const TimeOff = lazy(() => import('@/pages/TimeOff'));
const Users = lazy(() => import('@/pages/Users'));
const RolesPermissions = lazy(() => import('@/pages/RolesPermissions'));
const FinancialReports = lazy(() => import('@/pages/FinancialReports'));

function getRoleNames(user: { roles?: Array<{ name?: string }> } | null): string[] {
  return (user?.roles ?? [])
    .map((r) => String(r?.name ?? '').trim().toLowerCase())
    .filter(Boolean);
}

function hasAdminAccess(user: { roles?: Array<{ name?: string }> } | null): boolean {
  const names = getRoleNames(user);
  return names.some((n) => n === 'admin' || n === 'super_admin' || n === 'director');
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
  requirePermission,
  requireAnyPermission,
  requireSuperAdministrator = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requirePermission?: string;
  requireAnyPermission?: string[];
  requireSuperAdministrator?: boolean;
}) {
  const { user } = useAuth();
  if ((requireAdmin && !hasAdminAccess(user)) || (requirePermission && !hasPermission(user, requirePermission)) || (requireAnyPermission && !requireAnyPermission.some((permission) => hasPermission(user, permission))) || (requireSuperAdministrator && !isSuperAdministrator(user))) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const location = useLocation();
  const { token, user } = useAuth();
  const financialOnly = hasPermission(user, 'reports.financial.view') && !hasPermission(user, 'reports.hr.view') && !hasPermission(user, 'reports.all.view');
  const showInstallPrompt = !token && location.pathname === '/login';

  return (
    <>
      {showInstallPrompt ? <InstallPrompt /> : null}
      <Suspense fallback={<Preloader message="Loading page…" />}>
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
        <Route path="dashboard" element={<RoleRoute requirePermission="dashboard.view"><Dashboard /></RoleRoute>} />
        <Route path="events" element={<RoleRoute requirePermission="events.view"><Events /></RoleRoute>} />
        <Route path="events/:id" element={<RoleRoute requirePermission="events.view"><EventDetail /></RoleRoute>} />
        <Route
          path="crew"
          element={
            <RoleRoute requirePermission="employees.view"><Users
              title="Crew"
              subtitle="Manage crew members. Search, create, edit or delete and assign roles. Download an Excel template to add many people at once."
              sectionLabel="Crew members"
              createButtonLabel="Add crew"
              showPushTestActions
              showExcelImport
              showDeleteAllCrew
            /></RoleRoute>
          }
        />
        <Route path="event-operations" element={<RoleRoute requirePermission="events.view"><EventOperations /></RoleRoute>} />
        <Route path="tasks" element={<RoleRoute requirePermission="tasks.view"><Tasks /></RoleRoute>} />
        <Route path="equipment" element={<RoleRoute requirePermission="equipment.view"><Equipment /></RoleRoute>} />
        <Route path="transport" element={<RoleRoute requirePermission="transport.view"><Transport /></RoleRoute>} />
        <Route path="payments" element={<RoleRoute requirePermission="payments.view"><Payments /></RoleRoute>} />
        <Route path="allowances" element={<RoleRoute requirePermission="allowances.view"><Allowances /></RoleRoute>} />
        <Route path="holidays" element={<RoleRoute requirePermission="holidays.view"><Holidays /></RoleRoute>} />
        <Route path="clients" element={<RoleRoute requirePermission="clients.view"><Clients /></RoleRoute>} />
        <Route path="reports" element={<RoleRoute requireAnyPermission={['reports.all.view', 'reports.hr.view', 'reports.financial.view']}>{financialOnly ? <FinancialReports /> : <Reports />}</RoleRoute>} />
        <Route path="checkins" element={<RoleRoute requirePermission="attendance.view"><Checkins /></RoleRoute>} />
        <Route path="communication" element={<RoleRoute requirePermission="communications.manage"><Communication /></RoleRoute>} />
        <Route path="approvals" element={<RoleRoute requirePermission="approvals.manage"><Approvals /></RoleRoute>} />
        <Route path="users" element={<RoleRoute requireSuperAdministrator><Users title="Users & Permissions" subtitle="Manage users and assign roles." sectionLabel="Users" createButtonLabel="Create user" /></RoleRoute>} />
        <Route path="roles" element={<RoleRoute requireSuperAdministrator><RolesPermissions /></RoleRoute>} />
        <Route path="settings" element={<RoleRoute requirePermission="settings.manage"><Settings /></RoleRoute>} />
        <Route path="audit-logs" element={<RoleRoute requirePermission="audit.view"><AuditLogs /></RoleRoute>} />
        <Route path="help" element={<Help />} />
        <Route path="time-off" element={<RoleRoute requirePermission="timeoff.view"><TimeOff /></RoleRoute>} />
        <Route path="time-off/crew/:userId" element={<RoleRoute requirePermission="timeoff.view"><CrewMemberTimeOff /></RoleRoute>} />
        <Route path="profile" element={<Settings />} />
        <Route path="backup" element={<RoleRoute requirePermission="backup.manage"><Settings /></RoleRoute>} />
        <Route path="danger-zone" element={<RoleRoute requireSuperAdministrator><DangerZone /></RoleRoute>} />
        <Route path="more" element={<Placeholder title="More" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
      </Suspense>
    </>
  );
}
