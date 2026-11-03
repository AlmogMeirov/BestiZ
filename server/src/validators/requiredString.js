/**
 * A string field with its own "this is missing" message.
 *
 * Zod 4 removed `required_error`, which every validator here used to say
 * "userId is required" rather than letting Zod describe the shape mismatch.
 * It was removed silently: a schema still written as
 * `z.string({ required_error: '...' })` parses and validates exactly as
 * before, it just stops using the message. The API went on refusing the same
 * requests while explaining them worse, and nothing failed to say so.
 *
 * The replacement is a single `error` option covering every issue the schema
 * raises. Passing a bare string would flatten a distinction worth keeping:
 * a missing field and a field of the wrong type are different mistakes, and
 * "recipientId is required" is actively misleading when the caller sent a
 * number. Returning `undefined` from the callback hands that case back to
 * Zod, whose default — "Invalid input: expected string, received number" —
 * is the more useful sentence.
 *
 * @param {string} message shown when the field is absent.
 */

import { z } from 'zod';

export const requiredString = (message) =>
  z.string({
    error: (issue) => (issue.input === undefined ? message : undefined),
  });
