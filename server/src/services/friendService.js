/**
 * Friend service.
 * All business rules for friend requests and friendships live here.
 * Emits real-time events so users learn about incoming requests, accepted
 * requests, and removed friendships without refreshing.
 */

import * as friendRepository from '../repositories/friendRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import {
  emitFriendRequestReceived,
  emitFriendRequestAccepted,
  emitFriendRemoved,
} from '../socket/socketServer.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../middleware/errorHandler.js';

export const sendRequest = async ({ requesterId, addresseeId }) => {
  if (requesterId === addresseeId) {
    throw new BadRequestError('You cannot send a friend request to yourself');
  }
  // Verify the addressee exists.
  const addressee = await userRepository.findById(addresseeId);
  if (!addressee) {
    throw new NotFoundError('User not found');
  }

  // Check for existing friendship or pending request in either direction.
  const existing = await friendRepository.findBetween(requesterId, addresseeId);
  if (existing) {
    if (existing.status === 'accepted') {
      throw new BadRequestError('You are already friends with this user');
    }
    if (existing.requester_id === requesterId) {
      throw new BadRequestError('You already have a pending request to this user');
    }
    throw new BadRequestError(
      'This user has already sent you a friend request — accept it instead'
    );
  }

  // Create the friend request.
  const request = await friendRepository.createRequest({ requesterId, addresseeId });

  // Notify the addressee about the new request so their Requests page or
  // notification badge can update immediately.
  const requester = await userRepository.findById(requesterId);
  emitFriendRequestReceived(addresseeId, {
    id: request.id,
    status: request.status,
    created_at: request.created_at,
    requester_id: requesterId,
    requester_username: requester.username,
    requester_display_name: requester.display_name,
  });

  return request;
};
// Only the addressee can accept a pending friend request.
export const acceptRequest = async ({ friendshipId, currentUserId }) => {
  const friendship = await friendRepository.findById(friendshipId);
  if (!friendship) {
    throw new NotFoundError('Friend request not found');
  }
  if (friendship.addressee_id !== currentUserId) {
    throw new ForbiddenError('You can only accept requests sent to you');
  }
  if (friendship.status !== 'pending') {
    throw new BadRequestError('This request is no longer pending');
  }
  // Update the request to accepted.
  const updated = await friendRepository.acceptRequest(friendshipId);

  // Notify the original requester that their request was accepted.
  const acceptor = await userRepository.findById(currentUserId);
  emitFriendRequestAccepted(friendship.requester_id, {
    friendship_id: updated.id,
    id: currentUserId,
    username: acceptor.username,
    display_name: acceptor.display_name,
  });

  return updated;
};

// Either the requester or addressee can delete a friendship or pending request.
export const deleteFriendship = async ({ friendshipId, currentUserId }) => {
  const friendship = await friendRepository.findById(friendshipId);
  if (!friendship) {
    throw new NotFoundError('Friendship not found');
  }
  const isParticipant =
    friendship.requester_id === currentUserId ||
    friendship.addressee_id === currentUserId;
  if (!isParticipant) {
    throw new ForbiddenError('You are not part of this friendship');
  }

  await friendRepository.deleteById(friendshipId);

  // Notify the OTHER participant so their UI can drop the friendship.
  const otherUserId =
    friendship.requester_id === currentUserId
      ? friendship.addressee_id
      : friendship.requester_id;
  emitFriendRemoved(otherUserId, {
    friendshipId,
    byUserId: currentUserId,
  });
};
// List incoming friend requests for a user.
export const listIncomingRequests = (userId) =>
  friendRepository.findIncomingRequests(userId);
// List outgoing friend requests for a user.
export const listOutgoingRequests = (userId) =>
  friendRepository.findOutgoingRequests(userId);
// List accepted friends for a user. 
export const listFriends = (userId) => friendRepository.findFriends(userId);