// -----------------------------------------------------------------------------
// Shared JWT secret
// -----------------------------------------------------------------------------
// Both the login controller (which SIGNS tokens) and the auth middleware (which
// VERIFIES them) import this, so they can never drift onto different keys.
//
// In production (NODE_ENV=production), JWT_SECRET MUST be set via environment
// variable or the app will refuse to start. In development, a warning is logged
// but the app continues with a dev secret.
let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  const isDev = process.env.NODE_ENV !== 'production';
  if (!isDev) {
    throw new Error('[FATAL] JWT_SECRET is required in production. Set it as an environment variable.');
  }
  JWT_SECRET = 'dev-insecure-jwt-secret-change-me';
  // eslint-disable-next-line no-console
  console.warn('[auth] JWT_SECRET is not set — using an INSECURE dev secret. Set JWT_SECRET in production.');
}

module.exports = { JWT_SECRET };
