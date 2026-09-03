/**
 * Rate limiting.
 *
 * Two limiters with very different budgets, because the endpoints they protect
 * face very different threats:
 *
 *  - `authLimiter` guards login and registration. These are the endpoints an
 *    attacker hammers to guess passwords or enumerate accounts, and a real
 *    person signs in a handful of times a day. A tight budget costs legitimate
 *    users nothing and makes online password guessing impractical.
 *
 *  - `apiLimiter` guards everything else. Its job is not to stop guessing but
 *    to keep one client from monopolising the server. The budget is generous
 *    enough that normal browsing never notices it.
 *
 * What is deliberately NOT rate limited here: POST /api/auth/refresh. Every
 * active user's browser calls it automatically when the 15-minute access token
 * expires, so it fires on a schedule the user does not control. Putting it
 * behind the strict auth budget would log people out for browsing normally.
 * It is still protected: it requires a valid, unexpired refresh token, and it
 * falls under the general apiLimiter below.
 *
 * Counting is per IP address, held in memory. That is the right scope for a
 * single-instance deployment. Across several instances each would keep its own
 * tally and the effective limit would multiply, so a shared store (Redis) would
 * be the next step.
 */

import rateLimit from 'express-rate-limit';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Strict budget for credential-checking endpoints.
 * Exported so tests can reset the counter between cases.
 */
export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  // Return rate limit state in the standard RateLimit-* headers rather than
  // the legacy X-RateLimit-* ones.
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Successful logins don't count against the budget. The thing worth limiting
  // is failed guesses; someone who keeps signing in correctly is not attacking.
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many attempts from this address. Please try again later.',
  },
});

/**
 * General budget for the rest of the API.
 */
export const apiLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this address. Please try again later.',
  },
});
