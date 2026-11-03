/**
 * Unit tests for the "this field is missing" messages.
 *
 * These exist because their absence let a real regression through unnoticed.
 * Upgrading Zod from 3 to 4 removed `required_error`, and removed it quietly:
 * a schema still written with it parses and rejects exactly the same inputs,
 * it just stops using the message. Every "userId is required" in the API
 * silently became "Invalid input: expected string, received undefined", and
 * all 194 tests still passed, because not one of them submitted a request
 * with a field left out.
 *
 * A message is part of an API's contract. Someone integrating against it
 * reads these, and a sentence naming the field is worth more than one
 * describing a type mismatch. So they are pinned here, together with the
 * distinction worth keeping: a missing field and a field of the wrong type
 * are different mistakes and should not be given the same explanation.
 */

import { describe, expect, it } from 'vitest';

import { blockUserSchema } from '../../src/validators/blockValidators.js';
import {
  createCommentSchema,
  commentIdParamsSchema,
} from '../../src/validators/commentValidators.js';
import {
  friendshipIdParamsSchema,
  sendRequestSchema,
} from '../../src/validators/friendValidators.js';
import {
  conversationParamsSchema,
  requestIdParamsSchema,
  sendMessageSchema,
} from '../../src/validators/messageValidators.js';
import {
  createPostSchema,
  postIdParamsSchema,
} from '../../src/validators/postValidators.js';
import {
  searchUsersSchema,
  userIdParamsSchema,
} from '../../src/validators/userValidators.js';

const A_UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

const messageFor = (schema, input) => {
  const result = schema.safeParse(input);
  expect(result.success).toBe(false);
  return result.error.issues[0].message;
};

describe('a missing field is named in the message', () => {
  it.each([
    ['recipientId', sendMessageSchema, { content: 'hi' }, 'recipientId is required'],
    ['message content', sendMessageSchema, { recipientId: A_UUID }, 'Content is required'],
    ['conversation userId', conversationParamsSchema, {}, 'userId is required'],
    ['requestId', requestIdParamsSchema, {}, 'requestId is required'],
    ['blocked userId', blockUserSchema, {}, 'userId is required'],
    ['addresseeId', sendRequestSchema, {}, 'addresseeId is required'],
    ['friendship id', friendshipIdParamsSchema, {}, 'Friendship id is required'],
    ['post content', createPostSchema, {}, 'Content is required'],
    ['postId', postIdParamsSchema, {}, 'postId is required'],
    ['comment content', createCommentSchema, {}, 'Content is required'],
    ['commentId', commentIdParamsSchema, {}, 'commentId is required'],
    ['profile userId', userIdParamsSchema, {}, 'userId is required'],
    ['search query', searchUsersSchema, {}, 'Search query is required'],
  ])('%s', (_label, schema, input, expected) => {
    expect(messageFor(schema, input)).toBe(expected);
  });
});

describe('a field of the wrong type is told apart from a missing one', () => {
  // "recipientId is required" would be actively misleading to someone who
  // sent a number, so the type mismatch keeps Zod's own description.
  it('describes the mismatch rather than claiming the field is absent', () => {
    const message = messageFor(sendMessageSchema, {
      recipientId: 42,
      content: 'hi',
    });

    expect(message).not.toBe('recipientId is required');
    expect(message).toMatch(/expected string/i);
  });

  it('treats null as a wrong type, not as absent', () => {
    // `null` was supplied deliberately; only `undefined` means "not sent".
    const message = messageFor(sendMessageSchema, {
      recipientId: null,
      content: 'hi',
    });

    expect(message).not.toBe('recipientId is required');
    expect(message).toMatch(/expected string/i);
  });
});

describe('the other messages are unaffected', () => {
  // The required-field message applies only to absence: once a string is
  // present, the checks after it own their own wording.
  it('still reports a malformed uuid as a uuid problem', () => {
    expect(
      messageFor(sendMessageSchema, { recipientId: 'nope', content: 'hi' })
    ).toBe('recipientId must be a valid UUID');
  });

  it('still reports an empty message as empty, not as missing', () => {
    expect(
      messageFor(sendMessageSchema, { recipientId: A_UUID, content: '   ' })
    ).toBe('Content cannot be empty');
  });
});
