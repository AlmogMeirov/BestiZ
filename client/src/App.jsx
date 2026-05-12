/**
 * App component.
 * Defines the route structure for the entire application:
 *  - /login, /register: public auth pages (no layout).
 *  - All authenticated routes share the Layout (header with search & nav)
 *    and are wrapped in ProtectedRoute.
 *
 * Nested routes inside the Layout render in its <Outlet />.
 */

import { Navigate, Route, Routes } from 'react-router-dom';

import Layout from './components/Layout/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage/RegisterPage.jsx';
import FeedPage from './pages/FeedPage/FeedPage.jsx';
import UserProfilePage from './pages/UserProfilePage/UserProfilePage.jsx';
import FriendsPage from './pages/FriendsPage/FriendsPage.jsx';
import FriendRequestsPage from './pages/FriendRequestsPage/FriendRequestsPage.jsx';

function App() {
  return (
    <Routes>
      {/* Public routes — no layout, no auth required. */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes — wrapped in Layout (header) and require auth. */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/users/:userId" element={<UserProfilePage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/friends/requests" element={<FriendRequestsPage />} />
      </Route>

      {/* Catch-all: send to /feed (ProtectedRoute will bounce to login if needed). */}
      <Route path="*" element={<Navigate to="/feed" replace />} />
    </Routes>
  );
}

export default App;