'use strict';

const { getBearerToken } = require('../utils/http');
const { AuthError } = require('../errors/AppError');
const logger = require('../utils/logger');

/**
 * MKJ AI Core - Auth Middleware
 * -----------------------------------------------------------------------
 * This module DOES NOT reimplement or modify Firebase Authentication.
 * It only reads the bearer token already issued by the existing auth
 * system and exposes a hook point for verification.
 *
 * By design, this file does NOT import `firebase-admin` itself, so it
 * cannot collide with or duplicate the existing backend's Firebase
 * initialization. Instead, it accepts an optional `verifyToken` function
 * (injected by whoever wires up ai/index.js in the real deployment) that
 * should call the EXISTING project's firebase-admin instance.
 *
 * Until that verifier is wired in, `requireAuth` only checks that a
 * token is present and well-formed - it does not silently pretend to
 * authenticate. This is intentional: the AI Core must not fabricate
 * trust it can't actually verify.
 *
 * Wiring example (in index.js of the existing backend, NOT this module):
 *   const { setTokenVerifier } = require('./ai/middleware/auth.middleware');
 *   const admin = require('../your-existing-firebase-admin-init');
 *   setTokenVerifier((token) => admin.auth().verifyIdToken(token));
 */

let verifyTokenFn = null;

/**
 * Inject the real token verifier (expected to be Firebase's
 * `admin.auth().verifyIdToken`). Call this once, outside of request
 * handling, from the existing backend's bootstrap code.
 * @param {(token: string) => Promise<object>} fn - Resolves to decoded token / user record.
 */
function setTokenVerifier(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('setTokenVerifier expects a function.');
  }
  verifyTokenFn = fn;
}

/**
 * Extract and (if a verifier is configured) validate the caller's
 * identity from the Netlify event. Returns a minimal user context.
 *
 * @param {object} event - Netlify Function event.
 * @param {object} [options]
 * @param {boolean} [options.required=true] - Throw if no valid token found.
 * @returns {Promise<{uid: string|null, token: string|null, claims: object|null}>}
 */
async function requireAuth(event, options = {}) {
  const { required = true } = options;
  const token = getBearerToken(event);

  if (!token) {
    if (required) {
      throw new AuthError('Missing or malformed Authorization header.');
    }
    return { uid: null, token: null, claims: null };
  }

  if (!verifyTokenFn) {
    // No verifier wired in yet - fail closed for required auth rather
    // than trusting an unverified token.
    logger.warn('AI Core auth: no token verifier configured (setTokenVerifier not called).');
    if (required) {
      throw new AuthError('Authentication is not fully configured on the server.');
    }
    return { uid: null, token, claims: null };
  }

  try {
    const decoded = await verifyTokenFn(token);
    return {
      uid: decoded.uid || decoded.user_id || null,
      token,
      claims: decoded,
    };
  } catch (err) {
    logger.warn('AI Core auth: token verification failed', { err });
    throw new AuthError('Invalid or expired authentication token.');
  }
}

module.exports = {
  setTokenVerifier,
  requireAuth,
};
