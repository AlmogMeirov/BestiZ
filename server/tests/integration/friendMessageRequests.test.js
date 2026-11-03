/**
 * Integration tests for the seam between friendships and message requests.
 *
 * These two features overlap in exactly one place: a pending message request
 * between two people who then become friends. Friendship is the broader
 * permission, so `resolveSendState` stops consulting the request row — but the
 * row itself is what decides where the conversation appears, and a 'pending'
 * row keeps it parked in the recipient's Requests tab asking for a decision
 * that no longer means anything.
 *
 * Accepting the friendship therefore has to settle the request too, and the
 * two writes have to land together. The cases below pin down both halves, and
 * the choice between deleting the row and marking it accepted — which only
 * becomes visible if the friendship later ends.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// The service accepts the friendship and settles the message request in one
// transaction. The fake hands out a recognisable client so the tests can prove
// both writes were given the same one.
const TX_CLIENT = { query: vi.fn(), __tx: true };

vi.mock('../../src/config/database.js', () => ({
  pool: { query: vi.fn() },
  verifyDatabaseConnection: vi.fn(),
  withTransaction: vi.fn(async (fn) => fn(TX_CLIENT)),
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

vi.mock('../../src/repositories/messageRequestRepository.js', () => ({
  findBetween: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  setStatus: vi.fn(),
  deletePendingBetween: vi.fn(),
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
  emitPostCreated: vi.fn(),
  emitPostUpdated: vi.fn(),
  emitPostDeleted: vi.fn(),
  emitCommentCreated: vi.fn(),
  emitCommentUpdated: vi.fn(),
  emitCommentDeleted: vi.fn(),
  emitFriendRequestReceived: vi.fn(),
  emitFriendRequestAccepted: vi.fn(),
  emitFriendRemoved: vi.fn(),
  emitMessageReceived: vi.fn(),
  emitMessagesRead: vi.fn(),
  emitMessageRequestReceived: vi.fn(),
  emitMessageRequestAccepted: vi.fn(),
}));

const { buildApp } = await import('../../src/app.js');
const friendRepository = await import(
  '../../src/repositories/friendRepository.js'
);
const messageRequestRepository = await import(
  '../../src/repositories/messageRequestRepository.js'
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

// Almog asked Maya to be friends; Maya is the one who decides.
const pendingFriendship = {
  id: FRIENDSHIP_ID,
  requester_id: ALMOG.id,
  addressee_id: MAYA.id,
  status: 'pending',
};

const acceptAsMaya = () =>
  request(app)
    .post(`/api/friends/requests/${FRIENDSHIP_ID}/accept`)
    .set('Cookie', [`access_token=${generateAccessToken(MAYA.id)}`]);

beforeEach(() => {
  vi.clearAllMocks();
  userRepository.findById.mockResolvedValue(MAYA);
  friendRepository.findById.mockResolvedValue(pendingFriendship);
  friendRepository.acceptRequest.mockResolvedValue({
    ...pendingFriendship,
    status: 'accepted',
  });
  // No message request between them unless a case says otherwise.
  messageRequestRepository.deletePendingBetween.mockResolvedValue(undefined);
});

describe('accepting a friend request', () => {
  it('settles a pending message request between the two', async () => {
    const response = await acceptAsMaya();

    expect(response.status).toBe(200);
    expect(messageRequestRepository.deletePendingBetween).toHaveBeenCalledWith(
      ALMOG.id,
      MAYA.id,
      expect.anything()
    );
  });

  it('does both writes in one transaction', async () => {
    // A friendship accepted without the cleanup is precisely the inconsistent
    // state this exists to prevent, so the two must not be able to come apart.
    await acceptAsMaya();

    expect(friendRepository.acceptRequest).toHaveBeenCalledWith(
      FRIENDSHIP_ID,
      TX_CLIENT
    );
    expect(messageRequestRepository.deletePendingBetween).toHaveBeenCalledWith(
      ALMOG.id,
      MAYA.id,
      TX_CLIENT
    );
  });

  it('still tells the requester their request was accepted', async () => {
    await acceptAsMaya();

    expect(socketServer.emitFriendRequestAccepted).toHaveBeenCalledWith(
      ALMOG.id,
      expect.objectContaining({ id: MAYA.id, friendship_id: FRIENDSHIP_ID })
    );
  });

  it('succeeds when there was no message request at all', async () => {
    // Much the commonest case: two people who became friends without either
    // of them having written first.
    const response = await acceptAsMaya();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      friendship: { status: 'accepted' },
    });
  });

  it('settles the request whichever of them sent it', async () => {
    // The pair is passed as the friendship's two sides, and the repository
    // matches in either direction, so it does not matter whether the message
    // request ran the same way round as the friend request.
    friendRepository.findById.mockResolvedValue({
      ...pendingFriendship,
      requester_id: MAYA.id,
      addressee_id: ALMOG.id,
    });
    userRepository.findById.mockResolvedValue(ALMOG);

    await request(app)
      .post(`/api/friends/requests/${FRIENDSHIP_ID}/accept`)
      .set('Cookie', [`access_token=${generateAccessToken(ALMOG.id)}`]);

    const [a, b] = messageRequestRepository.deletePendingBetween.mock.calls[0];
    expect(new Set([a, b])).toEqual(new Set([ALMOG.id, MAYA.id]));
  });
});

describe('when the friendship is not accepted', () => {
  it('leaves the message request alone if the request vanished', async () => {
    friendRepository.findById.mockResolvedValue(undefined);

    const response = await acceptAsMaya();

    expect(response.status).toBe(404);
    expect(
      messageRequestRepository.deletePendingBetween
    ).not.toHaveBeenCalled();
  });

  it('leaves it alone when someone else tries to accept', async () => {
    // A third party, who is neither side of the friendship.
    const response = await request(app)
      .post(`/api/friends/requests/${FRIENDSHIP_ID}/accept`)
      .set('Cookie', [`access_token=${generateAccessToken(ALMOG.id)}`]);

    expect(response.status).toBe(403);
    expect(
      messageRequestRepository.deletePendingBetween
    ).not.toHaveBeenCalled();
  });

  it('leaves it alone when the request is already accepted', async () => {
    friendRepository.findById.mockResolvedValue({
      ...pendingFriendship,
      status: 'accepted',
    });

    const response = await acceptAsMaya();

    expect(response.status).toBe(400);
    expect(
      messageRequestRepository.deletePendingBetween
    ).not.toHaveBeenCalled();
  });

  it('rolls back rather than deleting on a lost race', async () => {
    // The status was read a moment ago, but the UPDATE is guarded by
    // `status = 'pending'` and returns nothing if another request won in
    // between. Deleting the message request on the strength of a friendship
    // that was never created would be the worst outcome of the three.
    friendRepository.acceptRequest.mockResolvedValue(undefined);

    const response = await acceptAsMaya();

    expect(response.status).toBe(400);
    expect(
      messageRequestRepository.deletePendingBetween
    ).not.toHaveBeenCalled();
    expect(socketServer.emitFriendRequestAccepted).not.toHaveBeenCalled();
  });
});
