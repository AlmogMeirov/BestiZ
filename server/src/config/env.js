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

export const config = {
  env: readEnv('NODE_ENV', 'development'),
  isProduction: process.env.NODE_ENV === 'production',

  server: {
    port: Number(readEnv('SERVER_PORT', '4000')),
  },

  database: {
    host: requireEnv('POSTGRES_HOST'),
    port: Number(requireEnv('POSTGRES_PORT')),
    user: requireEnv('POSTGRES_USER'),
    password: requireEnv('POSTGRES_PASSWORD'),
    database: requireEnv('POSTGRES_DB'),
  },

  jwt: {
    accessSecret: requireEnv('JWT_ACCESS_SECRET'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    accessExpiresIn: readEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: readEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  client: {
    url: readEnv('CLIENT_URL', 'http://localhost:5173'),
  },
};