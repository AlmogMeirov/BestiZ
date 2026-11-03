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


// Direct message events (always targeted at a single user)

/**
 * Delivers a new message to its recipient.
 *
 * Only the recipient is notified. The sender already has the message from the
 * HTTP response that created it, and emitting to them as well would show it
 * twice in the thread they are looking at.
 */
export const emitMessageReceived = (recipientId, message) => {
  emit(
    { type: 'users', ids: [recipientId] },
    SOCKET_EVENTS.MESSAGE_RECEIVED,
    { message }
  );
};

/**
 * Tells a sender that the other person has read their messages.
 *
 * Carries the specific ids rather than a blanket "all read" so the client can
 * mark exactly those, without assuming anything about messages it may not
 * have loaded yet.
 */
export const emitMessagesRead = (senderId, { readerId, messageIds }) => {
  emit(
    { type: 'users', ids: [senderId] },
    SOCKET_EVENTS.MESSAGE_READ,
    { readerId, messageIds }
  );
};

/**
 * Tells a recipient that a stranger has opened a conversation with them.
 *
 * Carries the opening message, since the whole point of the request is that
 * the recipient reads it before deciding. Deliberately distinct from
 * MESSAGE_RECEIVED so the client puts it in the Requests list rather than the
 * inbox.
 */
export const emitMessageRequestReceived = (recipientId, { message }) => {
  emit(
    { type: 'users', ids: [recipientId] },
    SOCKET_EVENTS.MESSAGE_REQUEST_RECEIVED,
    { message }
  );
};

/**
 * Tells a sender their message request was accepted and the conversation is
 * now open.
 *
 * There is no matching "declined" event, by design: a sender is never told
 * they were declined, so the absence of this event is all they ever observe.
 */
export const emitMessageRequestAccepted = (requesterId, { requestId, acceptedBy }) => {
  emit(
    { type: 'users', ids: [requesterId] },
    SOCKET_EVENTS.MESSAGE_REQUEST_ACCEPTED,
    { requestId, acceptedBy }
  );
};