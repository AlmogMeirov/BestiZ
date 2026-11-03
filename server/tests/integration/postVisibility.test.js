/**
 * Unit tests for who may see a post.
 *
 * This is the rule most worth pinning down in the whole application: getting
 * it wrong leaks someone's private writing, and nothing about the mistake is
 * visible until it has already happened.
 *
 * It is also the gate in front of commenting. `commentService.create` calls
 * `postService.getById` before writing anything, so a post nobody can see is a
 * post nobody can comment on — which means these cases cover comment
 * authorisation too.
 *
 * Exercised through the service with the repositories mocked. The equivalent
 * rules inside the feed's SQL are verified against a real database, since a
 * mocked repository cannot prove a WHERE clause.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  pool: { query: vi.fn() },
  verifyDatabaseConnection: vi.fn(),
  withTransaction: vi.fn(async (fn) => fn({ query: vi.fn() })),
}));

vi.mock('../../src/repositories/postRepository.js', () => ({
  findById: vi.fn(),
  findFeed: vi.fn(),
  findByAuthor: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
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

const postService = await import('../../src/services/postService.js');
const postRepository = await import('../../src/repositories/postRepository.js');
const blockRepository = await import('../../src/repositories/blockRepository.js');
const friendRepository = await import(
  '../../src/repositories/friendRepository.js'
);

const AUTHOR_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const VIEWER_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const POST_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const aPost = (visibility) => ({
  id: POST_ID,
  author_id: AUTHOR_ID,
  content: 'hello',
  visibility,
  created_at: new Date().toISOString(),
});

// Returns true when the viewer can see the post, false when the service hides
// it. A hidden post is reported as 404 rather than 403 on purpose: a 403 would
// confirm the post exists, which is itself a leak.
const canSee = async (visibility, viewerId = VIEWER_ID) => {
  postRepository.findById.mockResolvedValue(aPost(visibility));
  try {
    await postService.getById({ postId: POST_ID, viewerId });
    return true;
  } catch (error) {
    expect(error.statusCode).toBe(404);
    return false;
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  blockRepository.existsBetween.mockResolvedValue(false);
  friendRepository.areFriends.mockResolvedValue(false);
});

describe('visibility for a stranger', () => {
  it('shows a public post', async () => {
    expect(await canSee('public')).toBe(true);
  });

  it('hides a friends-only post', async () => {
    expect(await canSee('friends')).toBe(false);
  });

  it('hides a private post', async () => {
    expect(await canSee('private')).toBe(false);
  });
});

describe('visibility for a friend', () => {
  beforeEach(() => {
    friendRepository.areFriends.mockResolvedValue(true);
  });

  it('shows a public post', async () => {
    expect(await canSee('public')).toBe(true);
  });

  it('shows a friends-only post', async () => {
    expect(await canSee('friends')).toBe(true);
  });

  it('still hides a private post', async () => {
    // "Private" means the author alone, not "the author and their friends".
    expect(await canSee('private')).toBe(false);
  });
});

describe('visibility for the author', () => {
  it.each(['public', 'friends', 'private'])(
    'shows their own %s post',
    async (visibility) => {
      expect(await canSee(visibility, AUTHOR_ID)).toBe(true);
    }
  );

  it('does not need to ask about friendship or blocks', async () => {
    // The author short-circuits before either lookup, which is both correct
    // and two fewer queries on the commonest case.
    await canSee('private', AUTHOR_ID);

    expect(friendRepository.areFriends).not.toHaveBeenCalled();
    expect(blockRepository.existsBetween).not.toHaveBeenCalled();
  });
});

describe('visibility when the two have blocked each other', () => {
  beforeEach(() => {
    blockRepository.existsBetween.mockResolvedValue(true);
  });

  it.each(['public', 'friends', 'private'])(
    'hides a %s post',
    async (visibility) => {
      // A block overrides visibility entirely: even a public post, which the
      // whole world can read, is hidden from the blocked side.
      expect(await canSee(visibility)).toBe(false);
    }
  );

  it('hides it even while the two are still recorded as friends', async () => {
    // Blocking removes the friendship, but this check must not depend on that
    // having happened — a stale friendship row cannot reopen access.
    friendRepository.areFriends.mockResolvedValue(true);

    expect(await canSee('friends')).toBe(false);
  });

  it('is checked in both directions', async () => {
    // The repository call is undirected on purpose, so the blocker loses sight
    // of the blocked user's posts just as surely as the reverse.
    await canSee('public');

    expect(blockRepository.existsBetween).toHaveBeenCalledWith(
      AUTHOR_ID,
      VIEWER_ID
    );
  });

  it('is checked before visibility is considered', async () => {
    await canSee('public');

    expect(blockRepository.existsBetween).toHaveBeenCalled();
    expect(friendRepository.areFriends).not.toHaveBeenCalled();
  });
});

describe('a post that does not exist', () => {
  it('is reported the same way as one that is hidden', async () => {
    // Identical responses, so the status code cannot be used to discover
    // which post ids are real.
    postRepository.findById.mockResolvedValue(undefined);

    await expect(
      postService.getById({ postId: POST_ID, viewerId: VIEWER_ID })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
