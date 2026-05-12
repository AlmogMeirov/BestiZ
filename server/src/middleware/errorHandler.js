/**
 * Centralized error handling.
 * Routes and services throw `AppError` (or a subclass) for known failure cases.
 * The errorHandler middleware translates these into clean HTTP responses,
 * while unknown errors are logged and returned as a generic 500.
 */

 // Application-level error with an HTTP status code.
 // Anything thrown that isn't an AppError is treated as an unexpected 500.
export class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

// Convenience constructors for the common cases. Each one is a thin wrapper
// so call sites read like `throw new BadRequestError('...')` instead of magic numbers.
export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}
// 403 is "Forbidden" (authenticated but not allowed), not "Unauthorized".
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}
// 404 is "Not Found", not "Unauthorized".
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, message);
  }
}
// 409 is "Conflict", used when a request could not be completed due to a conflict with the current state of the resource.
export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(409, message);
  }
}

 // Express error-handling middleware. Must be registered last.
 // The 4-arg signature is required for Express to recognize this as an error handler.
 
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Unexpected error: log details for debugging but never leak internals to the client.
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
};