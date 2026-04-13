import { Navigate, Route, Routes } from 'react-router-dom';
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) {
    return <Preloader message="Checking session…" />;
  }
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <InstallPrompt />
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
        <Route path="crew" element={<Users title="Crew" subtitle="Manage crew members. Search, create, edit or delete and assign roles." sectionLabel="Crew members" createButtonLabel="Add crew" />} />
        <Route path="event-operations" element={<EventOperations />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="equipment" element={<Equipment />} />
        <Route path="transport" element={<Transport />} />
        <Route path="payments" element={<Payments />} />
        <Route path="allowances" element={<Allowances />} />
        <Route path="clients" element={<Clients />} />
        <Route path="reports" element={<Reports />} />
        <Route path="checkins" element={<Checkins />} />
        <Route path="communication" element={<Communication />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="users" element={<Users title="Users & Permissions" subtitle="Manage users and assign roles. Full access for admins." sectionLabel="Users" createButtonLabel="Create user" />} />
        <Route path="settings" element={<Settings />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="help" element={<Help />} />
        <Route path="time-off" element={<TimeOff />} />
        <Route path="time-off/crew/:userId" element={<CrewMemberTimeOff />} />
        <Route path="profile" element={<Settings />} />
        <Route path="backup" element={<Settings />} />
        <Route path="danger-zone" element={<DangerZone />} />
        <Route path="more" element={<Placeholder title="More" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
