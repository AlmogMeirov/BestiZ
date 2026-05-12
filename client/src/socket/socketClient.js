/**
 * Socket.IO client manager.
 * Owns the lifecycle of the single Socket.IO connection used throughout the app.
 * Connection is opened after login (when AuthContext knows there is a session) and closed on logout.
 *
 * The cookie-based JWT is sent automatically with the upgrade request because we pass `withCredentials: true`.
 * We connect directly to the API server (the same URL axios uses) rather than going through the Vite dev server.
 */

import { io as createSocket } from 'socket.io-client';

// Same env var as the axios client; one source of truth for the API URL.
const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

let socket = null;


 //Opens the socket connection (idempotent calling twice is a no-op).
export const connectSocket = () => {
  if (socket && socket.connected) {
    return socket;
  }
  if (socket) {
    socket.connect();
    return socket;
  }

  socket = createSocket(SOCKET_URL, {
    // Send cookies, that's how the access token JWT reaches the server.
    withCredentials: true,
    // Auto reconnect with exponential backoff (Socket.IO defaults).
    reconnection: true,
  });

  // Lightweight logging in development, helps when sanity-checking that real-time updates are flowing.
  socket.on('connect', () => {
    console.log('[socket] connected', socket.id);
  });
  socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected', reason);
  });
  socket.on('connect_error', (err) => {
    console.warn('[socket] connect error:', err.message);
  });

  return socket;
};


 // Closes the socket connection. 
 // Called on logout so the server stops sending events to a user who's no longer signed in.
 
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};


 // Returns the active socket, or null if not connected.
 // Components/hooks use this to register their own event listeners.

export const getSocket = () => socket;