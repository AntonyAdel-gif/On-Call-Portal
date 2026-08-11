// ============================================================================
// APP
// ----------------------------------------------------------------------------
// The root component. Sets up client-side routing (React Router) so the
// browser URL determines which page renders, without a full page reload.
//
//   /              -> public schedule page (no login required)
//   /login         -> login form
//   /my-schedule   -> employee dashboard: view rotation + request week swaps
//                     (protected: role must be 'user')
//   /admin         -> Admin dashboard (protected: role must be 'admin')
//   /super-admin   -> Super Admin dashboard (protected: role must be 'super_admin')
// ============================================================================

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Header from './components/Header.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import PublicSchedulePage from './pages/PublicSchedulePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import EmployeeDashboardPage from './pages/EmployeeDashboardPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import SuperAdminDashboardPage from './pages/SuperAdminDashboardPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      {/* AuthProvider is inside the router so session expiry can return users to the public schedule. */}
      <AuthProvider>
        {/* Header is outside <Routes>, so it stays visible on every page. */}
        <Header />

        <Routes>
          <Route path="/" element={<PublicSchedulePage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/my-schedule"
            element={
              <ProtectedRoute allowedRoles={['user']}>
                <EmployeeDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/super-admin"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SuperAdminDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all: any unknown URL falls back to the public page. */}
          <Route path="*" element={<PublicSchedulePage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
