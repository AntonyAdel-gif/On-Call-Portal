// ============================================================================
// PROTECTED ROUTE
// ----------------------------------------------------------------------------
// Wraps a page component and only renders it if the logged-in user has one
// of the allowed roles. Otherwise it redirects to /login.
//
// IMPORTANT: this is a UX convenience only. Real access control MUST also
// be enforced server-side (BE-01 auth middleware) - a client-side check
// like this can always be bypassed by a determined user, so the backend is
// the actual security boundary, not this component.
// ============================================================================

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    // Avoid a flash-redirect while we're still checking localStorage.
    return <p style={{ padding: 24 }}>Loading…</p>;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
