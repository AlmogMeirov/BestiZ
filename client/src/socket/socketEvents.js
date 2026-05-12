/**
 * Socket event names must stay in sync with the server's events.js.
 *
 * Duplicating the strings on both sides is a deliberate trade-off:
 * the alternative is sharing a module, which would require a shared package or build-time setup.
 * For an assignment-sized project, a carefully maintained pair of constants is simpler.
 */

export const SOCKET_EVENTS = {
  POST_CREATED: 'post:created',
  POST_UPDATED: 'post:updated',
  POST_DELETED: 'post:deleted',

  COMMENT_CREATED: 'comment:created',
  COMMENT_UPDATED: 'comment:updated',
  COMMENT_DELETED: 'comment:deleted',

  FRIEND_REQUEST_RECEIVED: 'friend:request_received',
  FRIEND_REQUEST_ACCEPTED: 'friend:request_accepted',
  FRIEND_REMOVED: 'friend:removed',
};