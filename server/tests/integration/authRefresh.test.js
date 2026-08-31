/**
 * Integration tests for POST /api/auth/refresh.
 *
 * These drive the real Express app through supertest: routing, cookie parsing,
 * the controller, and the error handler all run for real. Only the repository
 * layer is mocked, so no database is needed to run the suite.
 *
 * The refresh endpoint is the one place in the app that hands out a new session
 * without the user typing a password, which makes it the piece most worth
 * covering: every one of its rejection paths is a way in if it gets it wrong.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Mocked before the app is imported, so the controller picks up the mock.
vi.mock('../../src/repositories/userRepository.js', () => ({
  findById: vi.fn(),
}));

const { buildApp } = await import('../../src/app.js');
const userRepository = await import('../../src/repositories/userRepository.js');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } =
  await import('../../src/utils/tokens.js');

const USER = {
  id: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  username: 'almog_dev',
  display_name: 'Almog',
};

const app = buildApp();

// Pulls one named cookie out of a supertest response's Set-Cookie header.
const cookieFrom = (response, name) =>
  response.headers['set-cookie']?.find((c) => c.startsWith(`${name}=`));

// Extracts the raw token value from a Set-Cookie string.
const valueOf = (cookie) => cookie.split(';')[0].split('=')[1];

beforeEach(() => {
  vi.clearAllMocks();
  userRepository.findById.mockResolvedValue(USER);
});

describe('POST /api/auth/refresh - rejections', () => {
  it('returns 401 when no refresh cookie is sent', async () => {
    const response = await request(app).post('/api/auth/refresh');
    expect(response.status).toBe(401);
  });

  it('returns 401 for a malformed token', async () => {
    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', ['refresh_token=not.a.jwt']);
    expect(response.status).toBe(401);
  });

  it('returns 401 when an ACCESS token is presented as the refresh cookie', async () => {
    // The attack this blocks: a leaked access token being replayed here to mint
    // an endless supply of fresh sessions.
    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refresh_token=${generateAccessToken(USER.id)}`]);

    expect(response.status).toBe(401);
    expect(cookieFrom(response, 'access_token')).toBeUndefined();
  });

  it('returns 401 when the user behind a valid token no longer exists', async () => {
    userRepository.findById.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refresh_token=${generateRefreshToken(USER.id)}`]);

    expect(response.status).toBe(401);
  });

  it('never leaks internals in the error body', async () => {
    const response = await request(app).post('/api/auth/refresh');
    expect(response.body).toEqual({ error: expect.any(String) });
    expect(JSON.stringify(response.body)).not.toMatch(/secret|jwt|stack/i);
  });
});

describe('POST /api/auth/refresh - success', () => {
  it('returns 200 and the current user', async () => {
    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refresh_token=${generateRefreshToken(USER.id)}`]);

    expect(response.status).toBe(200);
    expect(response.body.user.username).toBe(USER.username);
  });

  it('works without an access token cookie present', async () => {
    // The whole point: by the time this is called, the access token is gone.
    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refresh_token=${generateRefreshToken(USER.id)}`]);

    expect(response.status).toBe(200);
  });

  it('issues a new access token cookie', async () => {
    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refresh_token=${generateRefreshToken(USER.id)}`]);

    expect(cookieFrom(response, 'access_token')).toBeDefined();
  });

  it('rotates the refresh token instead of reusing it', async () => {
    const original = generateRefreshToken(USER.id);

    // Tokens signed in the same second are byte-identical, so move the clock
    // forward to make the rotation observable.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 2000);

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refresh_token=${original}`]);

    vi.useRealTimers();

    const rotated = valueOf(cookieFrom(response, 'refresh_token'));
    expect(rotated).not.toBe(original);
    // The rotated token must still be a valid refresh token for the same user.
    expect(verifyRefreshToken(rotated).sub).toBe(USER.id);
  });

  it('marks both cookies httpOnly so JavaScript cannot read them', async () => {
    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refresh_token=${generateRefreshToken(USER.id)}`]);

    expect(cookieFrom(response, 'access_token')).toMatch(/HttpOnly/i);
    expect(cookieFrom(response, 'refresh_token')).toMatch(/HttpOnly/i);
  });

  it('sets SameSite=Lax on both cookies', async () => {
    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refresh_token=${generateRefreshToken(USER.id)}`]);

    expect(cookieFrom(response, 'access_token')).toMatch(/SameSite=Lax/i);
    expect(cookieFrom(response, 'refresh_token')).toMatch(/SameSite=Lax/i);
  });
});

describe('GET /api/auth/me - the 401 that triggers a refresh', () => {
  it('returns 401 with no access token, which is what the client interceptor reacts to', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  it('returns 401 when a REFRESH token is presented as the access cookie', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`access_token=${generateRefreshToken(USER.id)}`]);
    expect(response.status).toBe(401);
  });

  it('returns 200 with a valid access token', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`access_token=${generateAccessToken(USER.id)}`]);

    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(USER.id);
  });
});
