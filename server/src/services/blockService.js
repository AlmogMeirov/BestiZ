/**
 * Block service.
 *
 * Blocking is the strongest boundary one user can place on another. It cuts
 * the pair off in both directions:
 *
 *  - Neither can message the other, not even a first-contact message.
 *  - Neither can send the other a friend request.
 *  - Neither sees the other's posts, in the feed or on their profile.
 *  - Neither can comment on the other's posts, which follows for free from
 *    post visibility: commenting requires being able to see the post.
 *
 * What blocking does NOT do is delete anything. The message history survives,
 * because a conversation belongs to both people and one of them should not be
 * able to erase the other's copy. The message request row survives too, so
 * unblocking restores whatever state the pair was in rather than handing the
 * other person a fresh opening message.
 *
 * The one thing it does remove is the friendship, since a friendship is a
 * standing grant of access and leaving it in place while blocking would be
 * contradictory.
 */

import { withTransaction } from '../config/database.js';
import * as blockRepository from '../repositories/blockRepository.js';
import * as friendRepository from '../repositories/friendRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import { emitFriendRemoved } from '../socket/socketServer.js';
import {
  BadRequestError,
  NotFoundError,
} from '../middleware/errorHandler.js';

/**
 * Blocks another user.
 *
 * The block row and the friendship deletion are one transaction. Writing the
 * block without removing the friendship would leave a standing access grant
 * next to a boundary that contradicts it; removing the friendship without the
 * block would be a plain unfriend, which is not what was asked for.
 *
 * Idempotent: blocking someone already blocked succeeds and changes nothing.
 * The alternative — an error — would make the UI handle a case that means
 * "the state you wanted is the state you have".
 */
export const blockUser = async ({ blockerId, blockedId }) => {
  if (blockerId === blockedId) {
    throw new BadRequestError('You cannot block yourself');
  }

  const target = await userRepository.findById(blockedId);
  if (!target) {
    throw new NotFoundError('User not found');
  }

  const removedFriendshipId = await withTransaction(async (client) => {
    const created = await blockRepository.create(
      { blockerId, blockedId },
      client
    );

    // Already blocked: nothing further to do, and no friendship can exist.
    if (!created) {
      return null;
    }

    const friendship = await friendRepository.findBetween(
      blockerId,
      blockedId,
      client
    );
    if (!friendship) {
      return null;
    }

    await friendRepository.deleteById(friendship.id, client);
    return friendship.id;
  });

  // Emitted outside the transaction: a socket event cannot be rolled back, so
  // firing it before COMMIT risks telling the other user about a change that
  // never landed.
  //
  // This is the ordinary "friendship ended" event, deliberately not a
  // "you were blocked" one. The other side needs their UI to stop showing a
  // friendship that no longer exists; they are not told why. A blocked user
  // who cannot tell a block from ordinary silence has nothing to route
  // around.
  if (removedFriendshipId) {
    emitFriendRemoved(blockedId, {
      friendshipId: removedFriendshipId,
      byUserId: blockerId,
    });
  }

  return { blocked: true };
};

/**
 * Lifts a block.
 *
 * Does not restore the friendship that blocking removed. Re-adding it would
 * reinstate access the blocker took away deliberately, and the pair can simply
 * send a friend request again. After unblocking they are strangers with
 * history, which is the same state an unfriend leaves behind.
 *
 * Only the blocker's own row is touched, so this cannot be used to lift a
 * block someone else placed.
 */
export const unblockUser = async ({ blockerId, blockedId }) => {
  if (blockerId === blockedId) {
    throw new BadRequestError('You cannot unblock yourself');
  }

  const removed = await blockRepository.remove({ blockerId, blockedId });
  if (!removed) {
    throw new NotFoundError('You have not blocked this user');
  }

  return { blocked: false };
};

// The people this user has blocked. Who has blocked THEM is never listed.
export const listBlocked = (userId) =>
  blockRepository.findBlockedByUser(userId);
