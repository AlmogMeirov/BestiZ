/**
 * Socket.IO event names.
 * Centralized constants for all events emitted between server and clients.
 * Using constants prevents typos and gives a single place to see the complete real-time protocol.
 *
 * Naming convention:
 *  - Server → Client events use past-tense verbs ("posted", "deleted")
 *    since they describe something that already happened.
 *  - Client → Server events would use imperative verbs, but for this assignment all events flow server → client.
 */

export const SOCKET_EVENTS = {
  // Post events, emitted when posts change.
  POST_CREATED: 'post:created',
  POST_UPDATED: 'post:updated',
  POST_DELETED: 'post:deleted',

  // Comment events, emitted when comments change.
  COMMENT_CREATED: 'comment:created',
  COMMENT_UPDATED: 'comment:updated',
  COMMENT_DELETED: 'comment:deleted',

  // Friend events, emitted when friendship state changes.
  FRIEND_REQUEST_RECEIVED: 'friend:request_received',
  FRIEND_REQUEST_ACCEPTED: 'friend:request_accepted',
  FRIEND_REMOVED: 'friend:removed',

  // Direct message events. Unlike posts and comments these are never
  // broadcast — a message concerns exactly two people, so every one of them
  // goes to a single user's room.
  MESSAGE_RECEIVED: 'message:received',
  MESSAGE_READ: 'message:read',

  // Message request events. An opening message from a stranger arrives as a
  // REQUEST rather than a message: the conversation is not in the recipient's
  // inbox yet, so a 'message:received' would point their client at a thread it
  // has no row for.
  MESSAGE_REQUEST_RECEIVED: 'message:request_received',
  MESSAGE_REQUEST_ACCEPTED: 'message:request_accepted',
};

/**
 * Builds the user-specific room name. Each authenticated user joins their
 * own room on connection. The server emits to "user:<userId>" to reach all
 * of a single user's open tabs/devices at once.
 */
export const userRoom = (userId) => `user:${userId}`;