/**
 * Socket.IO server.
 * Initializes the Socket.IO instance attached to the existing HTTP server,
 * runs authentication on every incoming connection, and exposes emit
 * helpers that the service layer uses to broadcast real-time events.

 * Per-user rooms: each authenticated socket joins a room named `user:<userId>`.
 * This lets the emit helpers target a specific user (or set of users) with a simple
 * `server.to(...)` call regardless of which device(s) they're connected from.
 
 * Audience descriptors:
 *  - { type: 'broadcast', excludeUserId? }
 *      Send to every connected socket, optionally excluding one user
 *      (typically the actor whose UI already updated optimistically).
 *  - { type: 'users', ids: [...], excludeUserId? }
 *      Send only to the listed users' personal rooms, with the same optional exclusion.
 */

import { Server as IOServer } from 'socket.io';
import { config } from '../config/env.js';
import { socketAuth } from './socketAuth.js';
import { SOCKET_EVENTS, userRoom } from './events.js';

let io = null;
// Initializes the Socket.IO server and sets up authentication and connection handling.
export const initSocketServer = (httpServer) => {
  io = new IOServer(httpServer, {
    cors: {
      origin: config.client.url,
      credentials: true,
    },
  });

  io.use(socketAuth);

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    socket.join(userRoom(userId));
  });

  return io;
};
// Helper to get the Socket.IO server instance, ensuring it's initialized first.
const getIo = () => {
  if (!io) {
    throw new Error('Socket server has not been initialized');
  }
  return io;
};


 // Generic emitter. Handles both broadcast and per-user audiences,including an optional excluded user.
const emit = (audience, eventName, payload) => {
  const server = getIo();

  if (audience.type === 'broadcast') {
    if (audience.excludeUserId) {
      server
        .except(userRoom(audience.excludeUserId))
        .emit(eventName, payload);
    } else {
      server.emit(eventName, payload);
    }
    return;
  }

  // Targeted: emit to each user's personal room.
  for (const userId of audience.ids) {
    if (audience.excludeUserId && userId === audience.excludeUserId) continue;
    server.to(userRoom(userId)).emit(eventName, payload);
  }
};


// Post events
export const emitPostCreated = (audience, post) => {
  emit(audience, SOCKET_EVENTS.POST_CREATED, { post });
};

export const emitPostUpdated = (audience, post) => {
  emit(audience, SOCKET_EVENTS.POST_UPDATED, { post });
};

export const emitPostDeleted = (audience, postId) => {
  emit(audience, SOCKET_EVENTS.POST_DELETED, { postId });
};


// Comment events
export const emitCommentCreated = (audience, comment) => {
  emit(audience, SOCKET_EVENTS.COMMENT_CREATED, { comment });
};

export const emitCommentUpdated = (audience, comment) => {
  emit(audience, SOCKET_EVENTS.COMMENT_UPDATED, { comment });
};

export const emitCommentDeleted = (audience, { commentId, postId }) => {
  emit(audience, SOCKET_EVENTS.COMMENT_DELETED, { commentId, postId });
};


// Friendship events (always targeted at a single user)
export const emitFriendRequestReceived = (addresseeId, request) => {
  emit(
    { type: 'users', ids: [addresseeId] },
    SOCKET_EVENTS.FRIEND_REQUEST_RECEIVED,
    { request }
  );
};

export const emitFriendRequestAccepted = (requesterId, friendship) => {
  emit(
    { type: 'users', ids: [requesterId] },
    SOCKET_EVENTS.FRIEND_REQUEST_ACCEPTED,
    { friendship }
  );
};

export const emitFriendRemoved = (affectedUserId, { friendshipId, byUserId }) => {
  emit(
    { type: 'users', ids: [affectedUserId] },
    SOCKET_EVENTS.FRIEND_REMOVED,
    { friendshipId, byUserId }
  );
};