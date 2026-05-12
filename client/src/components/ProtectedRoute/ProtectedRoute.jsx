/**
 * ProtectedRoute.
 * Wraps routes that require authentication.
 * Uses the auth context to decide:
 *  - If still loading the session: show a loader (avoids flash of login page).
 *  - If not authenticated: redirect to /login.
 *  - If authenticated: render the wrapped page.
 * Used in App.jsx to gate routes like /feed.
 */

import { Navigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext.jsx';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  // While the session is being restored on app startup, render nothing  rather than briefly redirecting to /login and back.
  // A spinner could go here for longer-loading scenarios.
  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    // `replace` swaps the current entry in history instead of pushing a new one,
    // so clicking the browser's back button doesn't bounce them back to a protected page they can't access.
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;