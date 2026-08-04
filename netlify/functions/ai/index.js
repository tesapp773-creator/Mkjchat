'use strict';

/**
 * MKJ AI Core - Netlify Function Entrypoint
 * -----------------------------------------------------------------------
 * This file is deployed as a brand-new Netlify Function, entirely
 * separate from the existing backend. It does not import, require, or
 * modify any existing function file.
 *
 * Deployed path (Netlify default): /.netlify/functions/ai
 * (Because this file lives at netlify/functions/ai/index.js, Netlify
 * treats the `ai` directory as the function name and index.js as its
 * entrypoint.)
 *
 * Request contract:
 *   POST /.netlify/functions/ai
 *   Headers: Authorization: Bearer <firebase-id-token>   (optional per action)
 *   Body: { "action": "chat", "payload": { ... } }
 *
 * Response contract (success):
 *   { "success": true, "data": <action result>, "meta": {} }
 *
 * Response contract (error):
 *   { "error": { "message": string, "code": string, "details": object|null, "timestamp": string } }
 */

const { dispatch } = require('./router');
const { validateRequestEnvelope } = require('./middleware/validate.middleware');
const { requireAuth } = require('./middleware/auth.middleware');
const { checkAndConsume, pruneStaleBuckets } = require('./middleware/rateLimit.middleware');
const { parseBody } = require('./utils/http');
const { success, noContent } = require('./utils/response');
const { handleError } = require('./errors/errorHandler');
const { HTTP_STATUS, ACTIONS } = require('./constants');
const { AppError } = require('./errors/AppError');
const logger = require('./utils/logger');

// Actions that do not require a SERVER-VERIFIED bearer token.
//
// IMPORTANT / FOLLOW-UP: MKJ Chat's existing Netlify Functions (translate.js,
// gemini.js, etc.) have no server-side auth check at all today - there is no
// firebase-admin instance anywhere in this repo for auth.middleware.js to
// verify against yet. Requiring verified auth here would just make every
// request fail closed with 401, breaking the feature outright.
//
// So, matching the trust model this repo already has everywhere else, CHAT
// (and the other client-facing actions the MKJ AI frontend uses) are public
// for now. The client still sends the Firebase ID token on every request
// (see mkj-ai.js), so the day a firebase-admin instance is added and wired
// in via setTokenVerifier(), removing these from PUBLIC_ACTIONS is a
// one-line change with zero frontend impact.
const PUBLIC_ACTIONS = new Set([
  ACTIONS.HEALTH,
  ACTIONS.CHAT,
  ACTIONS.SEARCH,
  ACTIONS.VOICE_SYNTHESIZE,
  ACTIONS.VOICE_TOKEN,
]);

/**
 * @param {object} event - Netlify Function event.
 * @param {object} context - Netlify Function context.
 */
exports.handler = async (event, context) => {
  // Netlify Functions may reuse warm containers across invocations;
  // this keeps the in-memory rate limiter from growing unbounded.
  pruneStaleBuckets();

  if (event.httpMethod === 'OPTIONS') {
    return noContent();
  }

  if (event.httpMethod !== 'POST') {
    return handleError(
      new AppError('Method not allowed. Use POST.', {
        statusCode: HTTP_STATUS.METHOD_NOT_ALLOWED,
        code: 'AI_METHOD_NOT_ALLOWED',
      })
    );
  }

  let action;
  let payload;
  let authCtx = { uid: null, claims: null };

  try {
    const body = parseBody(event);
    const envelope = validateRequestEnvelope(body);
    action = envelope.action;
    payload = envelope.payload;

    const requiresAuth = !PUBLIC_ACTIONS.has(action);
    authCtx = await requireAuth(event, { required: requiresAuth });

    const rateLimitKey = authCtx.uid || event.headers?.['x-forwarded-for'] || 'anonymous';
    checkAndConsume(rateLimitKey);

    logger.info('AI Core request', {
      action,
      uid: authCtx.uid,
      requestId: context?.awsRequestId,
    });

    const data = await dispatch(action, payload, authCtx);

    return success(data, {
      meta: { action, provider: data?.provider },
    });
  } catch (err) {
    return handleError(err, {
      action,
      uid: authCtx.uid,
      requestId: context?.awsRequestId,
    });
  }
};
