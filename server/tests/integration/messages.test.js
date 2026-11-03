/**
 * Integration tests for direct messaging and message requests.
 *
 * These drive the real Express app through supertest — routing, auth
 * middleware, validation, the controller, the service's rules and the error
 * handler all execute. The repositories, the transaction helper and the socket
 * emitters are mocked, so no database or live socket server is needed.
 *
 * Mocking the emitters is not just a convenience: it lets these tests assert
 * WHO gets told about a message and WHICH event they get, both of which are
 * real rules that an end-to-end click-through would not reliably catch.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// The service opens a transaction for a first-contact message. Here it just
// runs the callback — the repositories it would coordinate are mocked anyway.
vi.mock('../../src/config/database.js', () => ({
  pool: { query: vi.fn() },
  verifyDatabaseConnection: vi.fn(),
  withTransaction: vi.fn(async (fn) => fn({ query: vi.fn() })),
}));

vi.mock('../../src/repositories/messageRepository.js', () => ({
  create: vi.fn(),
  findConversation: vi.fn(),
  findConversations: vi.fn(),
  markConversationRead: vi.fn(),
  countUnread: vi.fn(),
}));

vi.mock('../../src/repositories/messageRequestRepository.js', () => ({
  findBetween: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  setStatus: vi.fn(),
  findPendingForRecipient: vi.fn(),
  countPendingForRecipient: vi.fn(),
}));

vi.mock('../../src/repositories/blockRepository.js', () => ({
  existsBetween: vi.fn(),
  findByPair: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  findBlockedByUser: vi.fn(),
}));

vi.mock('../../src/repositories/friendRepository.js', () => ({
  areFriends: vi.fn(),
  findBetween: vi.fn(),
  findById: vi.fn(),
  createRequest: vi.fn(),
  acceptRequest: vi.fn(),
  deleteById: vi.fn(),
  findIncomingRequests: vi.fn(),
  findOutgoingRequests: vi.fn(),
  findFriends: vi.fn(),
  countFriends: vi.fn(),
}));

vi.mock('../../src/repositories/userRepository.js', () => ({
  findById: vi.fn(),
  findByEmailWithPassword: vi.fn(),
  findByUsernameWithPassword: vi.fn(),
  findConflicts: vi.fn(),
  create: vi.fn(),
  searchByUsername: vi.fn(),
  findEmailConflict: vi.fn(),
  updateProfile: vi.fn(),
}));

// The real emitters need an initialised Socket.IO server. Mocking them keeps
// the tests standalone and makes the emit calls assertable.
vi.mock('../../src/socket/socketServer.js', () => ({
  initSocketServer: vi.fn(),
  emitMessageReceived: vi.fn(),
  emitMessagesRead: vi.fn(),
  emitMessageRequestReceived: vi.fn(),
  emitMessageRequestAccepted: vi.fn(),
  emitPostCreated: vi.fn(),
  emitPostUpdated: vi.fn(),
  emitPostDeleted: vi.fn(),
  emitCommentCreated: vi.fn(),
  emitCommentUpdated: vi.fn(),
  emitCommentDeleted: vi.fn(),
  emitFriendRequestReceived: vi.fn(),
  emitFriendRequestAccepted: vi.fn(),
  emitFriendRemoved: vi.fn(),
}));

const { buildApp } = await import('../../src/app.js');
const messageRepository = await import(
  '../../src/repositories/messageRepository.js'
);
const messageRequestRepository = await import(
  '../../src/repositories/messageRequestRepository.js'
);
const friendRepository = await import(
  '../../src/repositories/friendRepository.js'
);
const blockRepository = await import('../../src/repositories/blockRepository.js');
const userRepository = await import('../../src/repositories/userRepository.js');
const socketServer = await import('../../src/socket/socketServer.js');
const { generateAccessToken } = await import('../../src/utils/tokens.js');
const { SEND_STATE } = await import('../../src/services/messageService.js');

const ALMOG = {
  id: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  username: 'almog',
  display_name: 'Almog Meirov',
};
const MAYA = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  username: 'maya_l',
  display_name: 'Maya Levi',
};
const REQUEST_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

const app = buildApp();

// Signs requests as Almog.
const asAlmog = (req) =>
  req.set('Cookie', [`access_token=${generateAccessToken(ALMOG.id)}`]);

const aMessage = (overrides = {}) => ({
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  sender_id: ALMOG.id,
  recipient_id: MAYA.id,
  content: 'hey',
  read: false,
  created_at: new Date().toISOString(),
  sender_username: ALMOG.username,
  sender_display_name: ALMOG.display_name,
  ...overrides,
});

// A pending request in the given direction.
const aPendingRequest = (requesterId, recipientId) => ({
  id: REQUEST_ID,
  requester_id: requesterId,
  recipient_id: recipientId,
  status: 'pending',
});

const send = (body) => asAlmog(request(app).post('/api/messages')).send(body);

beforeEach(() => {
  vi.clearAllMocks();
  userRepository.findById.mockResolvedValue(MAYA);
  // Default: strangers with no history and nobody blocked. Individual tests
  // narrow this.
  blockRepository.existsBetween.mockResolvedValue(false);
  friendRepository.areFriends.mockResolvedValue(false);
  messageRequestRepository.findBetween.mockResolvedValue(undefined);
  messageRequestRepository.create.mockResolvedValue(
    aPendingRequest(ALMOG.id, MAYA.id)
  );
  messageRequestRepository.setStatus.mockResolvedValue({
    ...aPendingRequest(ALMOG.id, MAYA.id),
    status: 'accepted',
  });
  messageRequestRepository.findPendingForRecipient.mockResolvedValue([]);
  messageRequestRepository.countPendingForRecipient.mockResolvedValue(0);
  messageRepository.create.mockResolvedValue(aMessage());
  messageRepository.findConversation.mockResolvedValue([]);
  messageRepository.findConversations.mockResolvedValue([]);
  messageRepository.markConversationRead.mockResolvedValue([]);
  messageRepository.countUnread.mockResolvedValue(0);
});

describe('POST /api/messages — between friends', () => {
  beforeEach(() => {
    friendRepository.areFriends.mockResolvedValue(true);
  });

  it('sends without creating a request', async () => {
    const response = await send({ recipientId: MAYA.id, content: 'hey' });

    expect(response.status).toBe(201);
    expect(messageRepository.create).toHaveBeenCalled();
    expect(messageRequestRepository.create).not.toHaveBeenCalled();
  });

  it('delivers as a message, not a request', async () => {
    await send({ recipientId: MAYA.id, content: 'hey' });

    expect(socketServer.emitMessageReceived).toHaveBeenCalledWith(
      MAYA.id,
      expect.objectContaining({ content: 'hey' })
    );
    expect(socketServer.emitMessageRequestReceived).not.toHaveBeenCalled();
  });

  it('pushes to the recipient only, never back to the sender', async () => {
    // The sender's client already has the message from this response.
    // Emitting to them too would show it twice in the open thread.
    await send({ recipientId: MAYA.id, content: 'hey' });

    expect(socketServer.emitMessageReceived).toHaveBeenCalledTimes(1);
    const [targetUserId] = socketServer.emitMessageReceived.mock.calls[0];
    expect(targetUserId).not.toBe(ALMOG.id);
  });
});

describe('POST /api/messages — first contact with a stranger', () => {
  it('is allowed', async () => {
    const response = await send({ recipientId: MAYA.id, content: 'hi there' });
    expect(response.status).toBe(201);
  });

  it('creates a pending request alongside the message', async () => {
    await send({ recipientId: MAYA.id, content: 'hi there' });

    expect(messageRequestRepository.create).toHaveBeenCalledWith(
      { requesterId: ALMOG.id, recipientId: MAYA.id },
      expect.anything()
    );
  });

  it('writes the message and the request in one transaction', async () => {
    // Either both land or neither does. A surviving message without its
    // request would hand the sender another free message; a surviving request
    // without its message would ask the recipient to approve an empty thread.
    const { withTransaction } = await import('../../src/config/database.js');

    await send({ recipientId: MAYA.id, content: 'hi there' });

    expect(withTransaction).toHaveBeenCalledTimes(1);
    const [client] = messageRepository.create.mock.calls[0].slice(1);
    const [requestClient] = messageRequestRepository.create.mock.calls[0].slice(1);
    expect(client).toBe(requestClient);
  });

  it('arrives as a request event, not a message event', async () => {
    // The conversation is not in the recipient's inbox yet, so a
    // "new message" would point their client at a thread it has no row for.
    await send({ recipientId: MAYA.id, content: 'hi there' });

    expect(socketServer.emitMessageRequestReceived).toHaveBeenCalledWith(
      MAYA.id,
      { message: expect.objectContaining({ content: 'hey' }) }
    );
    expect(socketServer.emitMessageReceived).not.toHaveBeenCalled();
  });

  it('turns a lost race into a refusal rather than a 500', async () => {
    // Two opening messages sent at once both pass the state check; the unique
    // pair index stops the second. 23505 is unique_violation.
    const { withTransaction } = await import('../../src/config/database.js');
    withTransaction.mockRejectedValueOnce(
      Object.assign(new Error('duplicate key'), { code: '23505' })
    );

    const response = await send({ recipientId: MAYA.id, content: 'hi there' });

    expect(response.status).toBe(403);
  });

  it('still surfaces an unexpected database error as a 500', async () => {
    const { withTransaction } = await import('../../src/config/database.js');
    withTransaction.mockRejectedValueOnce(
      Object.assign(new Error('connection lost'), { code: '08006' })
    );

    const response = await send({ recipientId: MAYA.id, content: 'hi there' });

    expect(response.status).toBe(500);
  });
});

describe('POST /api/messages — a second message before approval', () => {
  beforeEach(() => {
    // Almog already opened a request to Maya; she has not answered.
    messageRequestRepository.findBetween.mockResolvedValue(
      aPendingRequest(ALMOG.id, MAYA.id)
    );
  });

  it('is refused', async () => {
    const response = await send({ recipientId: MAYA.id, content: 'hello?' });

    expect(response.status).toBe(403);
    expect(messageRepository.create).not.toHaveBeenCalled();
  });

  it('does not create a second request', async () => {
    await send({ recipientId: MAYA.id, content: 'hello?' });
    expect(messageRequestRepository.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/messages — after a decline', () => {
  beforeEach(() => {
    messageRequestRepository.findBetween.mockResolvedValue({
      ...aPendingRequest(ALMOG.id, MAYA.id),
      status: 'declined',
    });
  });

  it('is refused', async () => {
    const response = await send({ recipientId: MAYA.id, content: 'please?' });
    expect(response.status).toBe(403);
  });

  it('never tells the sender they were declined', async () => {
    // A decline that announces itself invites the sender to work around it.
    // The wording has to be identical to the still-pending case.
    const declined = await send({ recipientId: MAYA.id, content: 'please?' });

    messageRequestRepository.findBetween.mockResolvedValue(
      aPendingRequest(ALMOG.id, MAYA.id)
    );
    const pending = await send({ recipientId: MAYA.id, content: 'please?' });

    expect(declined.body).toEqual(pending.body);
    expect(JSON.stringify(declined.body)).not.toMatch(/declin|block|reject/i);
  });
});

describe('POST /api/messages — replying to a request accepts it', () => {
  beforeEach(() => {
    // Maya opened the request; Almog is the one being asked.
    messageRequestRepository.findBetween.mockResolvedValue(
      aPendingRequest(MAYA.id, ALMOG.id)
    );
  });

  it('lets the recipient reply', async () => {
    const response = await send({ recipientId: MAYA.id, content: 'sure, hi' });
    expect(response.status).toBe(201);
  });

  it('flips the request to accepted', async () => {
    // Making them click Accept and then type would be ceremony, and leaving it
    // pending would trap the other side: they could not reply to the reply.
    await send({ recipientId: MAYA.id, content: 'sure, hi' });

    expect(messageRequestRepository.setStatus).toHaveBeenCalledWith(
      REQUEST_ID,
      'accepted'
    );
  });

  it('tells the original sender the conversation is open', async () => {
    await send({ recipientId: MAYA.id, content: 'sure, hi' });

    expect(socketServer.emitMessageRequestAccepted).toHaveBeenCalledWith(
      MAYA.id,
      { requestId: REQUEST_ID, acceptedBy: ALMOG.id }
    );
  });

  it('stays quiet if the request was answered in the meantime', async () => {
    // setStatus only touches pending rows, so a concurrent accept elsewhere
    // must not produce a second notification.
    messageRequestRepository.setStatus.mockResolvedValue(undefined);

    await send({ recipientId: MAYA.id, content: 'sure, hi' });

    expect(socketServer.emitMessageRequestAccepted).not.toHaveBeenCalled();
  });
});

describe('POST /api/messages — validation and identity', () => {
  it('rejects an unauthenticated sender', async () => {
    const response = await request(app)
      .post('/api/messages')
      .send({ recipientId: MAYA.id, content: 'hey' });

    expect(response.status).toBe(401);
    expect(messageRepository.create).not.toHaveBeenCalled();
  });

  it('refuses to message yourself', async () => {
    const response = await send({ recipientId: ALMOG.id, content: 'note' });
    expect(response.status).toBe(400);
  });

  it('returns 404 for a recipient who does not exist', async () => {
    userRepository.findById.mockResolvedValue(null);
    const response = await send({ recipientId: MAYA.id, content: 'hey' });
    expect(response.status).toBe(404);
  });

  it('checks the recipient exists before checking permission', async () => {
    // Otherwise the API would answer "you may not message this person" for ids
    // belonging to nobody, which is a misleading error.
    userRepository.findById.mockResolvedValue(null);

    await send({ recipientId: MAYA.id, content: 'hey' });

    expect(friendRepository.areFriends).not.toHaveBeenCalled();
    expect(messageRequestRepository.findBetween).not.toHaveBeenCalled();
  });

  it.each([
    ['empty content', { recipientId: MAYA.id, content: '' }],
    ['whitespace-only content', { recipientId: MAYA.id, content: '   ' }],
    ['missing content', { recipientId: MAYA.id }],
    ['missing recipient', { content: 'hey' }],
    ['a recipient id that is not a UUID', { recipientId: 'maya', content: 'hey' }],
  ])('rejects %s', async (_label, body) => {
    const response = await send(body);

    expect(response.status).toBe(400);
    expect(messageRepository.create).not.toHaveBeenCalled();
  });

  it('rejects content over the 2000 character limit', async () => {
    // Matches the message_max_length CHECK in the schema, so an over-long
    // message is refused with a readable error instead of a constraint error.
    const response = await send({
      recipientId: MAYA.id,
      content: 'x'.repeat(2001),
    });
    expect(response.status).toBe(400);
  });

  it('accepts content exactly at the limit', async () => {
    const response = await send({
      recipientId: MAYA.id,
      content: 'x'.repeat(2000),
    });
    expect(response.status).toBe(201);
  });

  it('trims surrounding whitespace before storing', async () => {
    await send({ recipientId: MAYA.id, content: '  hey maya  ' });

    expect(messageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'hey maya' }),
      expect.anything()
    );
  });
});

describe('GET /api/messages/:userId — reading a conversation', () => {
  it('returns the messages with the other participant', async () => {
    friendRepository.areFriends.mockResolvedValue(true);
    messageRepository.findConversation.mockResolvedValue([aMessage()]);

    const response = await asAlmog(request(app).get(`/api/messages/${MAYA.id}`));

    expect(response.status).toBe(200);
    expect(response.body.messages).toHaveLength(1);
    expect(response.body.participant.username).toBe(MAYA.username);
  });

  it('reports the send state so the client knows what to render', async () => {
    friendRepository.areFriends.mockResolvedValue(true);

    const response = await asAlmog(request(app).get(`/api/messages/${MAYA.id}`));

    expect(response.body.sendState).toBe(SEND_STATE.OPEN);
    expect(response.body.canReply).toBe(true);
  });

  it('hands the client the request id when there is one to accept', async () => {
    messageRequestRepository.findBetween.mockResolvedValue(
      aPendingRequest(MAYA.id, ALMOG.id)
    );

    const response = await asAlmog(request(app).get(`/api/messages/${MAYA.id}`));

    expect(response.body.sendState).toBe(SEND_STATE.REPLY_ACCEPTS);
    expect(response.body.pendingRequestId).toBe(REQUEST_ID);
  });

  it('stays readable after a friendship ends, with replies closed', async () => {
    // Ending a friendship stops new messages; it does not delete a history
    // that belongs to both people.
    messageRequestRepository.findBetween.mockResolvedValue({
      ...aPendingRequest(ALMOG.id, MAYA.id),
      status: 'declined',
    });
    messageRepository.findConversation.mockResolvedValue([aMessage()]);

    const response = await asAlmog(request(app).get(`/api/messages/${MAYA.id}`));

    expect(response.status).toBe(200);
    expect(response.body.messages).toHaveLength(1);
    expect(response.body.canReply).toBe(false);
  });

  it('rejects an unauthenticated reader', async () => {
    const response = await request(app).get(`/api/messages/${MAYA.id}`);
    expect(response.status).toBe(401);
  });

  it('rejects a conversation with yourself', async () => {
    const response = await asAlmog(request(app).get(`/api/messages/${ALMOG.id}`));
    expect(response.status).toBe(400);
  });

  it('returns 404 for a user who does not exist', async () => {
    userRepository.findById.mockResolvedValue(null);
    const response = await asAlmog(request(app).get(`/api/messages/${MAYA.id}`));
    expect(response.status).toBe(404);
  });

  it('rejects a participant id that is not a UUID', async () => {
    const response = await asAlmog(request(app).get('/api/messages/not-a-uuid'));
    expect(response.status).toBe(400);
  });

  it('passes the cursor and limit through to the query', async () => {
    const before = '2026-01-01T00:00:00.000Z';

    await asAlmog(
      request(app).get(`/api/messages/${MAYA.id}?before=${before}&limit=10`)
    );

    expect(messageRepository.findConversation).toHaveBeenCalledWith(
      expect.objectContaining({ before, limit: 10 })
    );
  });

  it('rejects a malformed cursor', async () => {
    const response = await asAlmog(
      request(app).get(`/api/messages/${MAYA.id}?before=yesterday`)
    );
    expect(response.status).toBe(400);
  });
});

describe('GET /api/messages/:userId — read receipts', () => {
  it('marks the other person’s messages as read in an open conversation', async () => {
    friendRepository.areFriends.mockResolvedValue(true);

    await asAlmog(request(app).get(`/api/messages/${MAYA.id}`));

    expect(messageRepository.markConversationRead).toHaveBeenCalledWith({
      userId: ALMOG.id,
      otherUserId: MAYA.id,
    });
  });

  it('tells the sender which messages were read', async () => {
    friendRepository.areFriends.mockResolvedValue(true);
    messageRepository.markConversationRead.mockResolvedValue(['m1', 'm2']);

    await asAlmog(request(app).get(`/api/messages/${MAYA.id}`));

    expect(socketServer.emitMessagesRead).toHaveBeenCalledWith(MAYA.id, {
      readerId: ALMOG.id,
      messageIds: ['m1', 'm2'],
    });
  });

  it('stays quiet when nothing was unread', async () => {
    // Re-opening an already-read conversation should not fire an event on
    // every render.
    friendRepository.areFriends.mockResolvedValue(true);
    messageRepository.markConversationRead.mockResolvedValue([]);

    await asAlmog(request(app).get(`/api/messages/${MAYA.id}`));

    expect(socketServer.emitMessagesRead).not.toHaveBeenCalled();
  });

  it('does not mark anything read when paging back through history', async () => {
    // Scrolling up through old messages is not reading new arrivals.
    friendRepository.areFriends.mockResolvedValue(true);

    await asAlmog(
      request(app).get(
        `/api/messages/${MAYA.id}?before=2026-01-01T00:00:00.000Z`
      )
    );

    expect(messageRepository.markConversationRead).not.toHaveBeenCalled();
  });

  it('sends no read receipt for an unaccepted request', async () => {
    // A receipt would tell a stranger their message was seen before the
    // recipient has decided anything.
    messageRequestRepository.findBetween.mockResolvedValue(
      aPendingRequest(MAYA.id, ALMOG.id)
    );
    messageRepository.findConversation.mockResolvedValue([aMessage()]);

    await asAlmog(request(app).get(`/api/messages/${MAYA.id}`));

    expect(messageRepository.markConversationRead).not.toHaveBeenCalled();
    expect(socketServer.emitMessagesRead).not.toHaveBeenCalled();
  });
});

describe('POST /api/messages/requests/:requestId/accept', () => {
  beforeEach(() => {
    messageRequestRepository.findById.mockResolvedValue(
      aPendingRequest(MAYA.id, ALMOG.id)
    );
  });

  const accept = (id = REQUEST_ID) =>
    asAlmog(request(app).post(`/api/messages/requests/${id}/accept`));

  it('accepts a request addressed to you', async () => {
    const response = await accept();

    expect(response.status).toBe(200);
    expect(messageRequestRepository.setStatus).toHaveBeenCalledWith(
      REQUEST_ID,
      'accepted'
    );
  });

  it('notifies the sender', async () => {
    await accept();

    expect(socketServer.emitMessageRequestAccepted).toHaveBeenCalledWith(
      MAYA.id,
      { requestId: REQUEST_ID, acceptedBy: ALMOG.id }
    );
  });

  it('refuses when you are the one who sent it', async () => {
    // Accepting your own request would make the approval meaningless. It is a
    // 403 rather than a validation error: the request is well-formed, the
    // caller simply is not the one entitled to decide.
    messageRequestRepository.findById.mockResolvedValue(
      aPendingRequest(ALMOG.id, MAYA.id)
    );

    const response = await accept();

    expect(response.status).toBe(403);
    expect(messageRequestRepository.setStatus).not.toHaveBeenCalled();
  });

  it('refuses an unrelated third party', async () => {
    messageRequestRepository.findById.mockResolvedValue(
      aPendingRequest(MAYA.id, '00000000-0000-4000-8000-000000000000')
    );

    const response = await accept();

    expect(response.status).toBe(403);
  });

  it('rejects a request that was already answered', async () => {
    messageRequestRepository.findById.mockResolvedValue({
      ...aPendingRequest(MAYA.id, ALMOG.id),
      status: 'accepted',
    });

    const response = await accept();

    expect(response.status).toBe(400);
    expect(messageRequestRepository.setStatus).not.toHaveBeenCalled();
  });

  it('returns 404 for a request that does not exist', async () => {
    messageRequestRepository.findById.mockResolvedValue(undefined);
    expect((await accept()).status).toBe(404);
  });

  it('rejects an id that is not a UUID', async () => {
    expect((await accept('nope')).status).toBe(400);
  });

  it('requires authentication', async () => {
    const response = await request(app).post(
      `/api/messages/requests/${REQUEST_ID}/accept`
    );
    expect(response.status).toBe(401);
  });
});

describe('POST /api/messages/requests/:requestId/decline', () => {
  beforeEach(() => {
    messageRequestRepository.findById.mockResolvedValue(
      aPendingRequest(MAYA.id, ALMOG.id)
    );
    messageRequestRepository.setStatus.mockResolvedValue({
      ...aPendingRequest(MAYA.id, ALMOG.id),
      status: 'declined',
    });
  });

  const decline = (id = REQUEST_ID) =>
    asAlmog(request(app).post(`/api/messages/requests/${id}/decline`));

  it('declines a request addressed to you', async () => {
    const response = await decline();

    expect(response.status).toBe(204);
    expect(messageRequestRepository.setStatus).toHaveBeenCalledWith(
      REQUEST_ID,
      'declined'
    );
  });

  it('keeps the row rather than deleting it', async () => {
    // Deleting would reset the pair to first contact and hand the sender a
    // fresh free message — the opposite of what declining is for.
    await decline();

    const [, status] = messageRequestRepository.setStatus.mock.calls[0];
    expect(status).toBe('declined');
  });

  it('tells the sender nothing at all', async () => {
    // There is no "declined" event by design: the absence of an acceptance is
    // all the sender ever observes.
    await decline();

    expect(socketServer.emitMessageRequestAccepted).not.toHaveBeenCalled();
    expect(socketServer.emitMessageReceived).not.toHaveBeenCalled();
    expect(socketServer.emitMessageRequestReceived).not.toHaveBeenCalled();
  });

  it('refuses when you are the one who sent it', async () => {
    messageRequestRepository.findById.mockResolvedValue(
      aPendingRequest(ALMOG.id, MAYA.id)
    );
    expect((await decline()).status).toBe(403);
  });

  it('rejects a request that was already answered', async () => {
    messageRequestRepository.findById.mockResolvedValue({
      ...aPendingRequest(MAYA.id, ALMOG.id),
      status: 'declined',
    });
    expect((await decline()).status).toBe(400);
  });

  it('requires authentication', async () => {
    const response = await request(app).post(
      `/api/messages/requests/${REQUEST_ID}/decline`
    );
    expect(response.status).toBe(401);
  });
});

describe('GET /api/messages/conversations, /requests and /unread-count', () => {
  it('lists the inbox', async () => {
    messageRepository.findConversations.mockResolvedValue([
      { id: MAYA.id, username: MAYA.username, unread_count: 2 },
    ]);

    const response = await asAlmog(
      request(app).get('/api/messages/conversations')
    );

    expect(response.status).toBe(200);
    expect(response.body.conversations).toHaveLength(1);
  });

  it('lists pending requests separately from the inbox', async () => {
    messageRequestRepository.findPendingForRecipient.mockResolvedValue([
      { request_id: REQUEST_ID, username: MAYA.username, opening_message: 'hi' },
    ]);

    const response = await asAlmog(request(app).get('/api/messages/requests'));

    expect(response.status).toBe(200);
    expect(response.body.requests[0].opening_message).toBe('hi');
  });

  it('counts unread messages and pending requests separately', async () => {
    // Folding a stranger's message into the unread badge would let anyone mark
    // the user's inbox without permission.
    messageRepository.countUnread.mockResolvedValue(7);
    messageRequestRepository.countPendingForRecipient.mockResolvedValue(3);

    const response = await asAlmog(
      request(app).get('/api/messages/unread-count')
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ messages: 7, requests: 3 });
  });

  it.each([
    ['/api/messages/conversations', () => messageRepository.findConversations],
    ['/api/messages/requests', () => messageRequestRepository.findPendingForRecipient],
    ['/api/messages/unread-count', () => messageRepository.countUnread],
  ])('does not let %s fall into the /:userId route', async (path, getSpy) => {
    // Express matches in registration order. With /:userId registered first,
    // "conversations" would be read as a user id and fail UUID validation.
    await asAlmog(request(app).get(path));

    expect(getSpy()).toHaveBeenCalled();
    expect(messageRepository.findConversation).not.toHaveBeenCalled();
  });

  it('requires authentication for all three', async () => {
    for (const path of [
      '/api/messages/conversations',
      '/api/messages/requests',
      '/api/messages/unread-count',
    ]) {
      expect((await request(app).get(path)).status).toBe(401);
    }
  });
});

describe('messaging a blocked user', () => {
  beforeEach(() => {
    blockRepository.existsBetween.mockResolvedValue(true);
  });

  it('refuses to send', async () => {
    const response = await send({ recipientId: MAYA.id, content: 'hey' });

    expect(response.status).toBe(403);
    expect(messageRepository.create).not.toHaveBeenCalled();
  });

  it('refuses even a first-contact message', async () => {
    // A block has to stop the one free message too, or it would not be a
    // block at all.
    messageRequestRepository.findBetween.mockResolvedValue(undefined);

    const response = await send({ recipientId: MAYA.id, content: 'hey' });

    expect(response.status).toBe(403);
    expect(messageRequestRepository.create).not.toHaveBeenCalled();
  });

  it('refuses even between friends', async () => {
    // Blocking removes the friendship, but the check must not depend on that
    // having happened — a stale friendship row cannot reopen a blocked
    // conversation.
    friendRepository.areFriends.mockResolvedValue(true);

    const response = await send({ recipientId: MAYA.id, content: 'hey' });

    expect(response.status).toBe(403);
  });

  it('refuses even with an accepted request', async () => {
    messageRequestRepository.findBetween.mockResolvedValue({
      ...aPendingRequest(MAYA.id, ALMOG.id),
      status: 'accepted',
    });

    const response = await send({ recipientId: MAYA.id, content: 'hey' });

    expect(response.status).toBe(403);
  });

  it('checks the block before anything else', async () => {
    // Nothing else needs establishing once a block is found, and asking no
    // further questions is also what keeps the error message uniform.
    await send({ recipientId: MAYA.id, content: 'hey' });

    expect(blockRepository.existsBetween).toHaveBeenCalled();
    expect(friendRepository.areFriends).not.toHaveBeenCalled();
    expect(messageRequestRepository.findBetween).not.toHaveBeenCalled();
  });

  it('does not reveal which side placed the block', async () => {
    const response = await send({ recipientId: MAYA.id, content: 'hey' });

    expect(JSON.stringify(response.body)).not.toMatch(
      /block|declin|reject|they/i
    );
  });

  it('still shows the conversation history', async () => {
    // A conversation belongs to both people; blocking ends it rather than
    // erasing it.
    messageRepository.findConversation.mockResolvedValue([aMessage()]);

    const response = await asAlmog(request(app).get(`/api/messages/${MAYA.id}`));

    expect(response.status).toBe(200);
    expect(response.body.messages).toHaveLength(1);
  });

  it('reports the blocked state with replies closed', async () => {
    const response = await asAlmog(request(app).get(`/api/messages/${MAYA.id}`));

    expect(response.body.sendState).toBe(SEND_STATE.BLOCKED);
    expect(response.body.canReply).toBe(false);
  });

  it('sends no read receipt', async () => {
    messageRepository.findConversation.mockResolvedValue([aMessage()]);

    await asAlmog(request(app).get(`/api/messages/${MAYA.id}`));

    expect(messageRepository.markConversationRead).not.toHaveBeenCalled();
    expect(socketServer.emitMessagesRead).not.toHaveBeenCalled();
  });
});
