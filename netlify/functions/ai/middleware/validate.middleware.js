'use strict';

const { ValidationError } = require('../errors/AppError');
const { ACTIONS } = require('../constants');

/**
 * Validate the top-level shape of an incoming AI Core request body:
 *   { action: string, payload: object }
 *
 * Per-service payload validation happens inside each service - this
 * middleware only guards the envelope so the router can safely dispatch.
 *
 * @param {object} body
 * @returns {{ action: string, payload: object }}
 */
function validateRequestEnvelope(body) {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object.');
  }

  const { action, payload } = body;

  if (typeof action !== 'string' || action.trim().length === 0) {
    throw new ValidationError('"action" is required and must be a string.', {
      allowedActions: Object.values(ACTIONS),
    });
  }

  if (payload !== undefined && (typeof payload !== 'object' || payload === null || Array.isArray(payload))) {
    throw new ValidationError('"payload" must be an object when provided.');
  }

  return { action: action.trim(), payload: payload || {} };
}

module.exports = {
  validateRequestEnvelope,
};
