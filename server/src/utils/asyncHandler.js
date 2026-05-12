/**
 * Wraps an async route handler so any thrown error or rejected promise
 * is forwarded to Express's error handling middleware via `next()`.
 * Without this, Express 4 ignores rejected promises from async handlers,
 * which causes uncaught errors to crash the server instead of returning a proper HTTP response.
 * Usage: router.post('/login', asyncHandler(authController.login));
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};