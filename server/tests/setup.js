/**
 * Test environment bootstrap.
 *
 * Provides the environment variables that `src/config/env.js` requires, so
 * application modules can be imported in tests without a real .env file or a
 * running database. The database values are placeholders: unit tests never
 * open a connection, and integration tests mock the repository layer.
 *
 * The JWT secrets here are deliberately different from each other so tests can
 * prove that an access token signed with one secret is rejected by the
 * verifier that uses the other.
 */

process.env.NODE_ENV = 'test';
process.env.SERVER_PORT = '4000';

process.env.POSTGRES_HOST = 'localhost';
process.env.POSTGRES_PORT = '5432';
process.env.POSTGRES_USER = 'test_user';
process.env.POSTGRES_PASSWORD = 'test_password';
process.env.POSTGRES_DB = 'bestiz_test';

process.env.JWT_ACCESS_SECRET = 'test_access_secret_at_least_32_characters_long';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_different_and_also_long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

process.env.CLIENT_URL = 'http://localhost:5173';
