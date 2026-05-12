/**
 * AuthContext - global authentication state for the entire app.
 * Also manages the lifecycle of the Socket.IO connection: opens it whenever a user is authenticated, closes it on logout.
 * Exposes `setUser` so flows that update the current user's profile (e.g.EditProfileModal) can refresh the auth context without doing a full session round-trip.
 */

import { createContext, useContext, useEffect, useState } from 'react';

import * as authApi from '../api/authApi.js';
import {
  connectSocket,
  disconnectSocket,
} from '../socket/socketClient.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const currentUser = await authApi.getMe();
        setUser(currentUser);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  useEffect(() => {
    if (user) {
      connectSocket();
    } else {
      disconnectSocket();
    }
  }, [user]);

  const login = async (credentials) => {
    const loggedInUser = await authApi.login(credentials);
    setUser(loggedInUser);
  };

  const register = async (data) => {
    const newUser = await authApi.register(data);
    setUser(newUser);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const value = {
    user,
    setUser,
    loading,
    isAuthenticated: user !== null,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};