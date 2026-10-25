/**
 * Integration tests for the production deployment behaviour.
 *
 * These cover the settings that only take effect once the app is deployed, and
 * that therefore nothing else in the suite exercises: serving the built client
 * from the same origin, the SPA fallback, the proxy trust setting, and the CSP
 * adjustments the client needs.
 *
 * Configuration bugs of this kind are the worst kind to find in production,
 * because they are invisible locally by definition. Testing them here means a
 * deploy is verified before it happens rather than after.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
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

// The app resolves the client build relative to its own file, so a stand-in
// index.html has to exist at that path for the static routes to respond.
const CLIENT_DIST = join(process.cwd(), '../client/dist');
const INDEX = join(CLIENT_DIST, 'index.html');
const MARKER = '<!doctype html><html><body>BESTIZ_CLIENT_STUB</body></html>';

// A developer may have a real `npm run build` sitting in client/dist. The stub
// must not become the last word on what that directory contains, so whatever
// was there before is put back afterwards.
let previousIndex = null;
let createdDist = false;

beforeAll(() => {
  if (existsSync(INDEX)) {
    previousIndex = readFileSync(INDEX, 'utf8');
  } else if (!existsSync(CLIENT_DIST)) {
    createdDist = true;
  }

  mkdirSync(CLIENT_DIST, { recursive: true });
  writeFileSync(INDEX, MARKER);
});

afterAll(() => {
  if (previousIndex !== null) {
    writeFileSync(INDEX, previousIndex);
  } else if (createdDist) {
    rmSync(CLIENT_DIST, { recursive: true, force: true });
  } else {
    rmSync(INDEX, { force: true });
  }
});

describe('single-origin client serving', () => {
  let app;

  beforeAll(async () => {
    vi.resetModules();
    process.env.SERVE_CLIENT = 'true';
    const { buildApp } = await import('../../src/app.js');
    app = buildApp();
  });

  afterAll(() => {
    process.env.SERVE_CLIENT = 'false';
  });

  it('serves the client at the root', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('BESTIZ_CLIENT_STUB');
  });

  it('falls back to index.html for a client-side route', async () => {
    // /friends is a React Router path with no server route behind it. Without
    // the fallback, refreshing that page in the browser would 404.
    const response = await request(app).get('/friends');
    expect(response.status).toBe(200);
    expect(response.text).toContain('BESTIZ_CLIENT_STUB');
  });

  it('does NOT swallow unknown API paths', async () => {
    // The fallback must exclude /api. Returning HTML here would make the client
    // fail to parse a response it expects to be JSON.
    //
    // The status is 401 rather than 404: the friends router is mounted at /api
    // and authenticates everything under it, so an unmatched path is rejected
    // for lack of a token before anything decides it does not exist. That is a
    // reasonable outcome — it declines to tell an anonymous caller which API
    // paths are real — and what matters here is that the response is a JSON
    // error from the API and not the client's HTML.
    const response = await request(app).get('/api/does-not-exist');

    expect(response.status).not.toBe(200);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.text).not.toContain('BESTIZ_CLIENT_STUB');
  });

  it('still routes real API requests to the API', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
    expect(response.text).not.toContain('BESTIZ_CLIENT_STUB');
  });
});

describe('content security policy', () => {
  let app;

  beforeAll(async () => {
    vi.resetModules();
    const { buildApp } = await import('../../src/app.js');
    app = buildApp();
  });

  it('allows images from any https host', async () => {
    // Posts store an arbitrary image URL. Helmet's default img-src would block
    // every one of them.
    const response = await request(app).get('/health');
    expect(response.headers['content-security-policy']).toContain('img-src');
    expect(response.headers['content-security-policy']).toMatch(
      /img-src[^;]*https:/
    );
  });

  it('allows websocket connections for Socket.IO', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['content-security-policy']).toMatch(
      /connect-src[^;]*wss:/
    );
  });
});

describe('proxy trust', () => {
  it('does not trust forwarded headers by default', async () => {
    vi.resetModules();
    delete process.env.TRUST_PROXY;
    const { buildApp } = await import('../../src/app.js');
    // Trusting a proxy that isn't there lets any client forge X-Forwarded-For
    // and hand itself a fresh rate limit budget on every request.
    expect(buildApp().get('trust proxy')).toBe(0);
  });

  it('trusts exactly one proxy hop when configured', async () => {
    vi.resetModules();
    process.env.TRUST_PROXY = '1';
    const { buildApp } = await import('../../src/app.js');
    expect(buildApp().get('trust proxy')).toBe(1);
    delete process.env.TRUST_PROXY;
  });
});
