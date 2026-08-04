'use strict';

const { AppError } = require('./AppError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants');
const logger = require('../utils/logger');

/**
 * Normalizes ANY thrown value (AppError, native Error, string, etc.) into
 * a safe, consistent Netlify Function response object.
 *
 * This is the single place where "what does an AI Core error response
 * look like" is decided. Services/providers should just throw; they
 * should never format HTTP responses themselves.
 *
 * @param {*} err
 * @param {object} [context] - Optional extra context for logging (requestId, action, etc.)
 * @returns {{statusCode: number, headers: object, body: string}}
 */
function handleError(err, context = {}) {
  const normalized = normalizeError(err);

  logger.error('AI Core error', {
    message: normalized.message,
    code: normalized.code,
    statusCode: normalized.statusCode,
    isOperational: normalized.isOperational,
    stack: normalized.stack,
    ...context,
  });

  return {
    statusCode: normalized.statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(normalized.toJSON()),
  };
}

/**
 * Coerces any thrown value into an AppError instance.
 * @param {*} err
 * @returns {AppError}
 */
function normalizeError(err) {
  if (err instanceof AppError) {
    return err;
  }

  if (err instanceof Error) {
    return new AppError(err.message || 'Internal server error', {
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.INTERNAL_ERROR,
      isOperational: false,
      cause: err,
    });
  }

  return new AppError(typeof err === 'string' ? err : 'Unknown error', {
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: ERROR_CODES.INTERNAL_ERROR,
    isOperational: false,
  });
}

module.exports = {
  handleError,
  normalizeError,
};
