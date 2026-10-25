/**
 * Centralized configuration module.
 * Loads environment variables and validates that all required values are present before the application starts.
 * Failing fast at startup is far safer than crashing on a request months later because of a typo'd env var name.
 */

import dotenv from 'dotenv';

// Load .env file (only useful when running outside Docker; inside Docker
// the variables are injected by docker-compose).
dotenv.config();


 // Reads an environment variable and throws if it's missing.
 // Use this for values that have no safe default.

const requireEnv = (key) => {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

 // Reads an environment variable with a default fallback.
const readEnv = (key, fallback) => {
  return process.env[key] ?? fallback;
};

/**
 * Database configuration comes from one of two sources.
 *
 * Locally, docker-compose injects the five POSTGRES_* variables. Managed
 * providers (Neon, Render, Railway, Heroku) instead hand out a single
 * DATABASE_URL connection string, which is the convention their dashboards and
 * docs are built around.
 *
 * DATABASE_URL wins when present, so a deployment never has to shred a
 * connection string into five separate variables by hand — a step that is easy
 * to get subtly wrong, especially with a password containing URL-escaped
 * characters.
 */
const buildDatabaseConfig = () => {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    return {
      connectionString,
      // Managed Postgres requires TLS. `rejectUnauthorized: false` accepts the
      // provider's certificate chain without bundling their CA. The connection
      // is still encrypted; what is skipped is verifying the certificate's
      // issuer, which is an acceptable trade-off against a provider-managed
      // host and the usual default in their own connection examples.
      ssl: { rejectUnauthorized: false },
    };
  }

  return {
    host: requireEnv('POSTGRES_HOST'),
    port: Number(requireEnv('POSTGRES_PORT')),
    user: requireEnv('POSTGRES_USER'),
    password: requireEnv('POSTGRES_PASSWORD'),
    database: requireEnv('POSTGRES_DB'),
  };
};

export const config = {
  env: readEnv('NODE_ENV', 'development'),
  isProduction: process.env.NODE_ENV === 'production',

  server: {
    port: Number(readEnv('SERVER_PORT', '4000')),
  },

  database: buildDatabaseConfig(),

  jwt: {
    accessSecret: requireEnv('JWT_ACCESS_SECRET'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    accessExpiresIn: readEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: readEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  client: {
    url: readEnv('CLIENT_URL', 'http://localhost:5173'),
  },

  /**
   * In production the built client is served by this same Express process, so
   * the browser talks to one origin for both the page and the API. That keeps
   * the auth cookies same-site: `SameSite=Lax` keeps working, and the CSRF
   * protection it provides is not traded away for `SameSite=None`, which a
   * split client/API deployment on two different hosts would have forced.
   */
  serveClient: readEnv('SERVE_CLIENT', 'false') === 'true',

  /**
   * Number of reverse proxies in front of the app. Platforms like Render put
   * exactly one there, which means every request arrives from the proxy's IP
   * unless Express is told to read X-Forwarded-For.
   *
   * This matters for rate limiting: left at 0 behind a proxy, every user shares
   * one counter and the whole world gets locked out together. Set higher than
   * reality and clients can forge the header to dodge the limit entirely, so it
   * is configuration rather than a hardcoded default.
   */
  trustProxy: Number(readEnv('TRUST_PROXY', '0')),
};