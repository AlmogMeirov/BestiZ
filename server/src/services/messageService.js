/**
 * Message service.
 * All business rules for direct messages live here.
 *
 * Who may message whom
 * --------------------
 * Friendship is one way a conversation is open, not the only one. A stranger
 * may send exactly ONE message; that message creates a pending request, and
 * the recipient decides whether the conversation continues. Accepting a
 * message request is not the same as becoming friends — it grants no access to
 * friends-only posts.
 *
 * Reading is deliberately NOT subject to those rules. If a friendship ends or
 * a request is declined, the conversation stays readable to both people but
 * nothing more can be added. Deleting the history would let one person erase a
 * record the other also owns, which is a worse default than letting a closed
 * conversation sit there.
 */

import { withTransaction } from '../config/database.js';
import * as messageRepository from '../repositories/messageRepository.js';
import * as messageRequestRepository from '../repositories/messageRequestRepository.js';
import * as friendRepository from '../repositories/friendRepository.js';
import * as blockRepository from '../repositories/blockRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import {
  emitMessageReceived,
  emitMessagesRead,
  emitMessageRequestReceived,
  emitMessageRequestAccepted,
} from '../socket/socketServer.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../middleware/errorHandler.js';

/**
 * The five states a pair can be in, from one sender's point of view.
 *
 * Exported so tests and the HTTP layer refer to the same strings rather than
 * repeating literals that could drift apart.
 */
export const SEND_STATE = {
  // Friends, or an accepted request: send freely.
  OPEN: 'open',
  // No request yet: one message is allowed and will create one.
  FIRST_CONTACT: 'first_contact',
  // They opened a request to us; replying is how we accept it.
  REPLY_ACCEPTS: 'reply_accepts',
  // We opened a request and it has not been accepted. Blocked.
  AWAITING_APPROVAL: 'awaiting_approval',
  // They declined. Blocked, and deliberately indistinguishable from the
  // state above in anything the sender is told.
  DECLINED: 'declined',
  // One of them has blocked the other. Overrides every other state.
  BLOCKED: 'blocked',
};

// States in which a message may actually be written.
const CAN_SEND = new Set([
  SEND_STATE.OPEN,
  SEND_STATE.FIRST_CONTACT,
  SEND_STATE.REPLY_ACCEPTS,
]);

/**
 * Works out which of the five states applies, and returns the request row
 * when one exists so the caller does not have to look it up again.
 */
const resolveSendState = async (senderId, recipientId) => {
  // Checked first, and in both directions: a block overrides friendship and
  // any accepted request, so there is no point establishing those before
  // ruling it out.
  if (await blockRepository.existsBetween(senderId, recipientId)) {
    return { state: SEND_STATE.BLOCKED, request: undefined };
  }

  if (await friendRepository.areFriends(senderId, recipientId)) {
    return { state: SEND_STATE.OPEN, request: undefined };
  }

  const request = await messageRequestRepository.findBetween(
    senderId,
    recipientId
  );

  if (!request) {
    return { state: SEND_STATE.FIRST_CONTACT, request: undefined };
  }
  if (request.status === 'accepted') {
    return { state: SEND_STATE.OPEN, request };
  }
  if (request.status === 'declined') {
    return { state: SEND_STATE.DECLINED, request };
  }
  // Pending: who is waiting on whom decides what the sender may do.
  return request.recipient_id === senderId
    ? { state: SEND_STATE.REPLY_ACCEPTS, request }
    : { state: SEND_STATE.AWAITING_APPROVAL, request };
};

/**
 * Sends a message.
 *
 * The checks run in a deliberate order: self, then existence, then
 * permission. Checking permission first would answer "may you message this
 * person" for ids belonging to nobody, which leaks nothing useful but makes
 * the errors misleading.
 */
export const sendMessage = async ({ senderId, recipientId, content }) => {
  if (senderId === recipientId) {
    throw new BadRequestError('You cannot send a message to yourself');
  }

  const recipient = await userRepository.findById(recipientId);
  if (!recipient) {
    throw new NotFoundError('User not found');
  }

  const { state, request } = await resolveSendState(senderId, recipientId);

  if (state === SEND_STATE.BLOCKED) {
    // Says what is true without saying why.
    //
    // A block cannot be hidden completely — someone who tries to write and
    // cannot has learned something. What this avoids is confirming it: the
    // wording is the same whichever of them blocked the other, so neither can
    // work out which. In practice a blocked user rarely gets this far, since
    // the blocker no longer appears in their search results or their feed.
    throw new ForbiddenError('You cannot send messages to this person');
  }

  if (!CAN_SEND.has(state)) {
    // One message for both AWAITING_APPROVAL and DECLINED. Telling a sender
    // they were specifically declined invites them to work around it, and the
    // wording below is true either way.
    throw new ForbiddenError(
      'You have already sent this person a message request. You can send more once they accept it.'
    );
  }

  if (state === SEND_STATE.FIRST_CONTACT) {
    return sendOpeningMessage({ senderId, recipientId, content, recipient });
  }

  const message = await messageRepository.create({
    senderId,
    recipientId,
    content,
  });

  if (state === SEND_STATE.REPLY_ACCEPTS) {
    // Replying to a stranger is acceptance. Making the recipient click Accept
    // and then type would be pure ceremony, and leaving the request pending
    // after they answered would trap the other side: they could not reply to
    // the reply.
    const accepted = await messageRequestRepository.setStatus(
      request.id,
      'accepted'
    );
    if (accepted) {
      emitMessageRequestAccepted(request.requester_id, {
        requestId: request.id,
        acceptedBy: senderId,
      });
    }
  }

  // The recipient's own room, which reaches every device they have open. The
  // sender is not notified: their client already has the message from this
  // response, and echoing it back would show it twice in the open thread.
  emitMessageReceived(recipientId, message);

  return message;
};

/**
 * First contact: the message and the request row are written together.
 *
 * Atomicity matters in both directions. If the request insert failed and the
 * message survived, the sender would get another free message. If the message
 * failed and the request survived, the recipient would be asked to approve a
 * conversation with nothing in it.
 *
 * The unique pair index is the real enforcement. Two opening messages racing
 * each other both pass the state check, then one loses on the index and rolls
 * back — a guarantee no amount of application-level checking could give.
 */
const sendOpeningMessage = async ({
  senderId,
  recipientId,
  content,
  recipient,
}) => {
  let message;
  try {
    message = await withTransaction(async (client) => {
      const created = await messageRepository.create(
        { senderId, recipientId, content },
        client
      );
      await messageRequestRepository.create(
        { requesterId: senderId, recipientId },
        client
      );
      return created;
    });
  } catch (error) {
    // 23505 is unique_violation: another opening message won the race.
    if (error.code === '23505') {
      throw new ForbiddenError(
        'You have already sent this person a message request. You can send more once they accept it.'
      );
    }
    throw error;
  }

  // A request event rather than a message event. The conversation is not in
  // the recipient's inbox yet, so telling their client "new message" would
  // point at a thread it cannot show.
  emitMessageRequestReceived(recipientId, { message });

  return message;
};

/**
 * Returns one page of a conversation, and marks the other person's messages as
 * read in the same call.
 *
 * Fetching and marking together is intentional. A separate "mark read"
 * endpoint would need the client to remember to call it, and the one place we
 * can be sure the messages were put in front of the user is the moment the
 * conversation was requested.
 */
export const getConversation = async ({
  userId,
  otherUserId,
  limit,
  before,
}) => {
  if (userId === otherUserId) {
    throw new BadRequestError('You cannot open a conversation with yourself');
  }

  const other = await userRepository.findById(otherUserId);
  if (!other) {
    throw new NotFoundError('User not found');
  }

  const messages = await messageRepository.findConversation({
    userId,
    otherUserId,
    limit,
    before,
  });

  const { state, request } = await resolveSendState(userId, otherUserId);

  // Only mark read on the first page of an open conversation.
  //
  // Paging back through old messages is scrolling history, not reading new
  // arrivals. And an unaccepted request stays unread on purpose: a read
  // receipt would tell a stranger their message was seen before the recipient
  // has decided anything.
  if (!before && state === SEND_STATE.OPEN) {
    const readIds = await messageRepository.markConversationRead({
      userId,
      otherUserId,
    });

    // Empty when nothing changed, so re-opening a conversation emits nothing.
    if (readIds.length > 0) {
      emitMessagesRead(otherUserId, { readerId: userId, messageIds: readIds });
    }
  }

  return {
    messages,
    participant: {
      id: other.id,
      username: other.username,
      display_name: other.display_name,
    },
    // `sendState` drives what the client shows: a composer, a "waiting to be
    // accepted" notice, or Accept/Decline buttons. `canReply` is the plain
    // boolean the composer itself needs.
    sendState: state,
    canReply: CAN_SEND.has(state),
    // Present only when there is a request the viewer can act on, so the
    // client never has to guess which id to accept.
    pendingRequestId:
      state === SEND_STATE.REPLY_ACCEPTS ? request.id : undefined,
  };
};

/**
 * Accepts a message request, opening the conversation both ways.
 *
 * Only the recipient may accept. The requester accepting their own request
 * would make the approval meaningless, so that is a 403 rather than a
 * validation error: the request exists and is well-formed, the caller simply
 * is not the one entitled to decide.
 */
export const acceptRequest = async ({ requestId, currentUserId }) => {
  const request = await messageRequestRepository.findById(requestId);
  if (!request) {
    throw new NotFoundError('Message request not found');
  }
  if (request.recipient_id !== currentUserId) {
    throw new ForbiddenError('You can only accept requests sent to you');
  }
  if (request.status !== 'pending') {
    throw new BadRequestError('This request has already been answered');
  }

  const accepted = await messageRequestRepository.setStatus(
    requestId,
    'accepted'
  );

  emitMessageRequestAccepted(request.requester_id, {
    requestId,
    acceptedBy: currentUserId,
  });

  return accepted;
};

/**
 * Declines a message request.
 *
 * No event is emitted. The sender is never told they were declined — they see
 * the same "not yet accepted" state as before, which is what stops a decline
 * from reading as an invitation to try again from another angle.
 *
 * The row is kept rather than deleted: that is what blocks a second opening
 * message, since deleting it would reset the pair to first contact.
 */
export const declineRequest = async ({ requestId, currentUserId }) => {
  const request = await messageRequestRepository.findById(requestId);
  if (!request) {
    throw new NotFoundError('Message request not found');
  }
  if (request.recipient_id !== currentUserId) {
    throw new ForbiddenError('You can only decline requests sent to you');
  }
  if (request.status !== 'pending') {
    throw new BadRequestError('This request has already been answered');
  }

  return messageRequestRepository.setStatus(requestId, 'declined');
};

// Lists every conversation in the user's inbox, most recent first.
export const listConversations = (userId) =>
  messageRepository.findConversations(userId);

// Lists the message requests awaiting this user's decision.
export const listRequests = (userId) =>
  messageRequestRepository.findPendingForRecipient(userId);

/**
 * The two counts the navigation bar needs.
 *
 * Returned together because the client always wants both, and kept separate
 * because they mean different things: unread messages are from people the
 * user has already accepted, while requests are decisions they have not made
 * yet. Folding a stranger's message into the unread badge would let anyone
 * mark the user's inbox without permission.
 */
export const getUnreadCount = async (userId) => {
  const [messages, requests] = await Promise.all([
    messageRepository.countUnread(userId),
    messageRequestRepository.countPendingForRecipient(userId),
  ]);
  return { messages, requests };
};
