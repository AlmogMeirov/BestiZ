/**
 * Unit tests for the JWT token utilities.
 *
 * The property these tests care about most is SEPARATION: access tokens and
 * refresh tokens are signed with different secrets and carry a `type` claim,
 * so neither can be used in the other's place. That separation is what stops a
 * leaked short-lived access token from being replayed against the refresh
 * endpoint to mint an unlimited supply of new sessions.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../src/utils/tokens.js';

const USER_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

afterEach(() => {
  vi.useRealTimers();
});

describe('access tokens', () => {
  it('round-trips the user id through sign and verify', () => {
    const token = generateAccessToken(USER_ID);
    expect(verifyAccessToken(token).sub).toBe(USER_ID);
  });

  it('carries an explicit access type claim', () => {
    const payload = jwt.decode(generateAccessToken(USER_ID));
    expect(payload.type).toBe('access');
  });

  it('keeps the payload minimal - id and type only, no user data', () => {
    const payload = jwt.decode(generateAccessToken(USER_ID));
    // iat and exp are added by jsonwebtoken itself.
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub', 'type']);
  });

  it('expires after the configured lifetime', () => {
    const token = generateAccessToken(USER_ID);

    // Jump 16 minutes ahead: past the 15m access lifetime.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);

    expect(() => verifyAccessToken(token)).toThrow();
  });
});

describe('refresh tokens', () => {
  it('round-trips the user id through sign and verify', () => {
    const token = generateRefreshToken(USER_ID);
    expect(verifyRefreshToken(token).sub).toBe(USER_ID);
  });

  it('carries an explicit refresh type claim', () => {
    const payload = jwt.decode(generateRefreshToken(USER_ID));
    expect(payload.type).toBe('refresh');
  });

  it('outlives an access token issued at the same moment', () => {
    const access = jwt.decode(generateAccessToken(USER_ID));
    const refresh = jwt.decode(generateRefreshToken(USER_ID));
    expect(refresh.exp).toBeGreaterThan(access.exp);
  });
});

describe('token type separation', () => {
  it('rejects a refresh token presented as an access token', () => {
    const refresh = generateRefreshToken(USER_ID);
    expect(() => verifyAccessToken(refresh)).toThrow();
  });

  it('rejects an access token presented as a refresh token', () => {
    const access = generateAccessToken(USER_ID);
    expect(() => verifyRefreshToken(access)).toThrow();
  });

  it('rejects a token signed with an unknown secret', () => {
    const forged = jwt.sign({ sub: USER_ID, type: 'access' }, 'not_our_secret');
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it('rejects a well-signed token whose type claim was tampered with', () => {
    // Signed with the correct refresh secret, but claiming to be an access
    // token. Signature verification alone would pass; the type check catches it.
    const mislabelled = jwt.sign(
      { sub: USER_ID, type: 'access' },
      process.env.JWT_REFRESH_SECRET
    );
    expect(() => verifyRefreshToken(mislabelled)).toThrow('Invalid token type');
  });

  it('rejects a malformed token', () => {
    expect(() => verifyAccessToken('not.a.jwt')).toThrow();
  });
});
