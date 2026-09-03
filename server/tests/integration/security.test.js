/**
 * Integration tests for the security middleware: helmet's response headers and
 * the rate limiters.
 *
 * Middleware is easy to add and easy to lose. A reordered `app.use`, a stray
 * refactor, or an upgrade that changes a default can silently drop protection
 * while every other test stays green — nothing else in the suite would notice.
 * These tests fail loudly when that happens.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

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

const { buildApp } = await import('../../src/app.js');
const userRepository = await import('../../src/repositories/userRepository.js');
const { authLimiter, apiLimiter } = await import(
  '../../src/middleware/rateLimiters.js'
);
const { generateRefreshToken } = await import('../../src/utils/tokens.js');

const USER = {
  id: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  username: 'almog_dev',
  display_name: 'Almog',
};

const app = buildApp();

// supertest connects over loopback, so every request shares one key.
const LOOPBACK_KEYS = ['::ffff:127.0.0.1', '127.0.0.1', '::1'];

const resetLimiters = async () => {
  for (const key of LOOPBACK_KEYS) {
    await authLimiter.resetKey(key);
    await apiLimiter.resetKey(key);
  }
};

beforeEach(async () => {
  vi.clearAllMocks();
  // No such user, so every login attempt fails and counts against the budget.
  userRepository.findByUsernameWithPassword.mockResolvedValue(null);
  userRepository.findById.mockResolvedValue(USER);
  await resetLimiters();
});

describe('security headers', () => {
  it('sets X-Content-Type-Options to nosniff', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options to deny clickjacking', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['x-frame-options']).toMatch(/deny|sameorigin/i);
  });

  it('sends a Content-Security-Policy', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['content-security-policy']).toBeDefined();
  });

  it('removes the X-Powered-By header that advertises Express', async () => {
    // Not a vulnerability on its own, but it hands an attacker the stack for
    // free and narrows which exploits they bother trying.
    const response = await request(app).get('/health');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('allows cross-origin reads, since the client is on another origin', async () => {
    // Helmet defaults this to same-origin, which would break the browser
    // client. The override is deliberate and worth pinning down.
    const response = await request(app).get('/health');
    expect(response.headers['cross-origin-resource-policy']).toBe(
      'cross-origin'
    );
  });

  it('sets the headers on error responses too, not just successful ones', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('rate limiting on credential endpoints', () => {
  const attemptLogin = () =>
    request(app)
      .post('/api/auth/login')
      .send({ identifier: 'almog_dev', password: 'wrong-password' });

  it('allows a legitimate number of failed attempts', async () => {
    for (let i = 0; i < 10; i += 1) {
      const response = await attemptLogin();
      expect(response.status).toBe(401);
    }
  });

  it('blocks the attempt after the budget is spent', async () => {
    for (let i = 0; i < 10; i += 1) {
      await attemptLogin();
    }

    const blocked = await attemptLogin();
    expect(blocked.status).toBe(429);
  });

  it('explains the block without leaking internals', async () => {
    for (let i = 0; i < 11; i += 1) {
      await attemptLogin();
    }

    const blocked = await attemptLogin();
    expect(blocked.body).toEqual({ error: expect.any(String) });
    expect(JSON.stringify(blocked.body)).not.toMatch(/secret|stack|sql/i);
  });

  it('advertises the remaining budget in standard headers', async () => {
    const response = await attemptLogin();
    expect(response.headers['ratelimit']).toBeDefined();
  });

  it('applies the same budget to registration', async () => {
    const attemptRegister = () =>
      request(app).post('/api/auth/register').send({ username: 'x' });

    for (let i = 0; i < 11; i += 1) {
      await attemptRegister();
    }

    const blocked = await attemptRegister();
    expect(blocked.status).toBe(429);
  });
});

describe('endpoints deliberately outside the strict budget', () => {
  it('does not throttle the refresh endpoint', async () => {
    // Every active user's browser calls this on a timer they don't control.
    // Throttling it at the auth budget would log people out for browsing.
    const token = generateRefreshToken(USER.id);

    const statuses = [];
    for (let i = 0; i < 15; i += 1) {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refresh_token=${token}`]);
      statuses.push(response.status);
    }

    expect(statuses).not.toContain(429);
  });

  it('does not throttle the health check', async () => {
    // Uptime monitors poll this constantly; a throttled health check reads as
    // an outage. It sits outside /api, so the general limiter never sees it.
    const statuses = [];
    for (let i = 0; i < 20; i += 1) {
      const response = await request(app).get('/health');
      statuses.push(response.status);
    }

    expect(statuses.every((status) => status === 200)).toBe(true);
  });
});
