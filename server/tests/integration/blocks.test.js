/**
 * Integration tests for blocking.
 *
 * These cover the block endpoints themselves and the one piece of real logic
 * behind them: that blocking also removes the friendship, atomically, and
 * tells the other side only that the friendship ended.
 *
 * The enforcement a block produces elsewhere — messaging, posts, comments,
 * search — is verified where it lives: the messaging cases are in
 * messages.test.js, and the SQL-level exclusions are exercised against a real
 * database, since a mocked repository cannot prove a WHERE clause works.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// The service opens a transaction to write the block and delete the
// friendship together. Here it just runs the callback.
vi.mock('../../src/config/database.js', () => ({
  pool: { query: vi.fn() },
  verifyDatabaseConnection: vi.fn(),
  withTransaction: vi.fn(async (fn) => fn({ query: vi.fn() })),
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

vi.mock('../../src/socket/socketServer.js', () => ({
  initSocketServer: vi.fn(),
  emitFriendRemoved: vi.fn(),
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
}));

const { buildApp } = await import('../../src/app.js');
const blockRepository = await import('../../src/repositories/blockRepository.js');
const friendRepository = await import(
  '../../src/repositories/friendRepository.js'
);
const userRepository = await import('../../src/repositories/userRepository.js');
const socketServer = await import('../../src/socket/socketServer.js');
const { generateAccessToken } = await import('../../src/utils/tokens.js');

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
const FRIENDSHIP_ID = '5a8e1f22-0c3b-4e5d-9f71-6a2c8d4e1b09';

const app = buildApp();

const asAlmog = (req) =>
  req.set('Cookie', [`access_token=${generateAccessToken(ALMOG.id)}`]);

const block = (body) => asAlmog(request(app).post('/api/blocks')).send(body);
const unblock = (userId) =>
  asAlmog(request(app).delete(`/api/blocks/${userId}`));

beforeEach(() => {
  vi.clearAllMocks();
  userRepository.findById.mockResolvedValue(MAYA);
  blockRepository.create.mockResolvedValue({
    id: 'b1',
    blocker_id: ALMOG.id,
    blocked_id: MAYA.id,
  });
  blockRepository.remove.mockResolvedValue(true);
  blockRepository.findBlockedByUser.mockResolvedValue([]);
  // No friendship by default; the cases that need one set it.
  friendRepository.findBetween.mockResolvedValue(undefined);
  friendRepository.deleteById.mockResolvedValue(true);
});

describe('POST /api/blocks', () => {
  it('blocks a user', async () => {
    const response = await block({ userId: MAYA.id });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ blocked: true });
    expect(blockRepository.create).toHaveBeenCalledWith(
      { blockerId: ALMOG.id, blockedId: MAYA.id },
      expect.anything()
    );
  });

  it('requires authentication', async () => {
    const response = await request(app)
      .post('/api/blocks')
      .send({ userId: MAYA.id });

    expect(response.status).toBe(401);
    expect(blockRepository.create).not.toHaveBeenCalled();
  });

  it('refuses to block yourself', async () => {
    const response = await block({ userId: ALMOG.id });

    expect(response.status).toBe(400);
    expect(blockRepository.create).not.toHaveBeenCalled();
  });

  it('returns 404 for a user who does not exist', async () => {
    userRepository.findById.mockResolvedValue(null);
    expect((await block({ userId: MAYA.id })).status).toBe(404);
  });

  it.each([
    ['a missing id', {}],
    ['an id that is not a UUID', { userId: 'maya' }],
  ])('rejects %s', async (_label, body) => {
    expect((await block(body)).status).toBe(400);
  });
});

describe('POST /api/blocks — removing the friendship', () => {
  beforeEach(() => {
    friendRepository.findBetween.mockResolvedValue({
      id: FRIENDSHIP_ID,
      requester_id: ALMOG.id,
      addressee_id: MAYA.id,
      status: 'accepted',
    });
  });

  it('deletes the friendship', async () => {
    // A friendship is a standing grant of access; leaving it next to a block
    // would be contradictory.
    await block({ userId: MAYA.id });

    expect(friendRepository.deleteById).toHaveBeenCalledWith(
      FRIENDSHIP_ID,
      expect.anything()
    );
  });

  it('writes the block and the deletion in one transaction', async () => {
    const { withTransaction } = await import('../../src/config/database.js');

    await block({ userId: MAYA.id });

    expect(withTransaction).toHaveBeenCalledTimes(1);
    const [, blockClient] = blockRepository.create.mock.calls[0];
    const [, deleteClient] = friendRepository.deleteById.mock.calls[0];
    expect(blockClient).toBe(deleteClient);
  });

  it('tells the other side the friendship ended', async () => {
    await block({ userId: MAYA.id });

    expect(socketServer.emitFriendRemoved).toHaveBeenCalledWith(MAYA.id, {
      friendshipId: FRIENDSHIP_ID,
      byUserId: ALMOG.id,
    });
  });

  it('never tells them they were blocked', async () => {
    // The other side needs their UI to stop showing a friendship that no
    // longer exists. They are not told why, and there is no block event for
    // any client to receive.
    await block({ userId: MAYA.id });

    const payloads = socketServer.emitFriendRemoved.mock.calls
      .map((call) => JSON.stringify(call))
      .join(' ');
    expect(payloads).not.toMatch(/block/i);
  });

  it('emits nothing when there was no friendship', async () => {
    friendRepository.findBetween.mockResolvedValue(undefined);

    await block({ userId: MAYA.id });

    expect(friendRepository.deleteById).not.toHaveBeenCalled();
    expect(socketServer.emitFriendRemoved).not.toHaveBeenCalled();
  });
});

describe('POST /api/blocks — blocking twice', () => {
  beforeEach(() => {
    // ON CONFLICT DO NOTHING returned no row: the block already existed.
    blockRepository.create.mockResolvedValue(undefined);
  });

  it('succeeds instead of erroring', async () => {
    // Blocking someone already blocked is the state the caller asked for.
    // Erroring would make the UI handle "nothing to do" as a failure.
    const response = await block({ userId: MAYA.id });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ blocked: true });
  });

  it('does not touch the friendship a second time', async () => {
    friendRepository.findBetween.mockResolvedValue({
      id: FRIENDSHIP_ID,
      requester_id: ALMOG.id,
      addressee_id: MAYA.id,
      status: 'accepted',
    });

    await block({ userId: MAYA.id });

    expect(friendRepository.deleteById).not.toHaveBeenCalled();
    expect(socketServer.emitFriendRemoved).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/blocks/:userId', () => {
  it('lifts the block', async () => {
    const response = await unblock(MAYA.id);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ blocked: false });
    expect(blockRepository.remove).toHaveBeenCalledWith({
      blockerId: ALMOG.id,
      blockedId: MAYA.id,
    });
  });

  it('does not restore the friendship it removed', async () => {
    // Re-adding it would reinstate access the blocker took away on purpose.
    // After unblocking they are strangers with history, and a friend request
    // is how they get back.
    await unblock(MAYA.id);

    expect(friendRepository.createRequest).not.toHaveBeenCalled();
    expect(friendRepository.acceptRequest).not.toHaveBeenCalled();
  });

  it('returns 404 when there was no block to lift', async () => {
    blockRepository.remove.mockResolvedValue(false);
    expect((await unblock(MAYA.id)).status).toBe(404);
  });

  it('only ever touches the caller’s own row', async () => {
    // One user must not be able to lift a block the other placed on them.
    await unblock(MAYA.id);

    const [args] = blockRepository.remove.mock.calls[0];
    expect(args.blockerId).toBe(ALMOG.id);
  });

  it('refuses to unblock yourself', async () => {
    expect((await unblock(ALMOG.id)).status).toBe(400);
  });

  it('rejects an id that is not a UUID', async () => {
    expect((await unblock('maya')).status).toBe(400);
  });

  it('requires authentication', async () => {
    const response = await request(app).delete(`/api/blocks/${MAYA.id}`);
    expect(response.status).toBe(401);
  });
});

describe('GET /api/blocks', () => {
  it('lists who the user has blocked', async () => {
    blockRepository.findBlockedByUser.mockResolvedValue([
      { block_id: 'b1', id: MAYA.id, username: MAYA.username },
    ]);

    const response = await asAlmog(request(app).get('/api/blocks'));

    expect(response.status).toBe(200);
    expect(response.body.blocked).toHaveLength(1);
  });

  it('asks only for blocks this user placed', async () => {
    // Who has blocked THEM is the other person's business, and surfacing it
    // would defeat the point of not announcing a block.
    await asAlmog(request(app).get('/api/blocks'));

    expect(blockRepository.findBlockedByUser).toHaveBeenCalledWith(ALMOG.id);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/blocks')).status).toBe(401);
  });
});
