import React from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { VerificationPage } from './pages/VerificationPage';
import { CompliancePage } from './pages/CompliancePage';
import { InspectionsPage } from './pages/InspectionsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AuditPage } from './pages/AuditPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { UndertakingsPage } from './pages/UndertakingsPage';
import { SetupPage } from './pages/SetupPage';
import { RoutingPage } from './pages/RoutingPage';
import { RequirementsPage } from './pages/RequirementsPage';
import { NotFoundPage } from './pages/NotFoundPage';

const ProtectedRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Loading FlowPilot...
      </div>
    );
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

const RoleRoute: React.FC<{ roles: string[]; children: React.ReactElement }> = ({ roles, children }) => {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Loading FlowPilot...
      </div>
    );
  }
  return user ? <Navigate to="/" replace /> : children;
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="verification" element={<VerificationPage />} />
          <Route path="compliance" element={<CompliancePage />} />
          <Route path="inspections" element={<InspectionsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route
            path="audit"
            element={
              <RoleRoute roles={['ADMIN', 'OFFICER']}>
                <AuditPage />
              </RoleRoute>
            }
          />
          <Route
            path="users"
            element={
              <RoleRoute roles={['ADMIN']}>
                <UsersPage />
              </RoleRoute>
            }
          />
          <Route
            path="routing"
            element={
              <RoleRoute roles={['ADMIN']}>
                <RoutingPage />
              </RoleRoute>
            }
          />
          <Route
            path="requirements"
            element={
              <RoleRoute roles={['ADMIN']}>
                <RequirementsPage />
              </RoleRoute>
            }
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="undertakings" element={<UndertakingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
