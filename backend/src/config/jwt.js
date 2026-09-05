// -----------------------------------------------------------------------------
// Shared JWT secret
// -----------------------------------------------------------------------------
// Both the login controller (which SIGNS tokens) and the auth middleware (which
// VERIFIES them) import this, so they can never drift onto different keys.
//
// Falls back to a dev secret so the app still boots locally without extra setup,
// but warns loudly. ALWAYS set JWT_SECRET in production (Railway env var) — the
// fallback is public knowledge and offers no real protection.
// -----------------------------------------------------------------------------
let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  JWT_SECRET = 'dev-insecure-jwt-secret-change-me';
  // eslint-disable-next-line no-console
  console.warn('[auth] JWT_SECRET is not set — using an INSECURE dev secret. Set JWT_SECRET in production.');
}

module.exports = { JWT_SECRET };
