'use strict';

const { ValidationError } = require('../errors/AppError');
const { LIMITS } = require('../constants');

/**
 * Small, dependency-free validation helpers. Not a full schema library on
 * purpose - this module only needs to guard the AI Core's own inputs.
 */

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireString(value, fieldName) {
  if (!isNonEmptyString(value)) {
    throw new ValidationError(`"${fieldName}" is required and must be a non-empty string.`, {
      field: fieldName,
    });
  }
  return value.trim();
}

function requireOneOf(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    throw new ValidationError(
      `"${fieldName}" must be one of: ${allowed.join(', ')}. Received: ${String(value)}`,
      { field: fieldName, allowed }
    );
  }
  return value;
}

function requireArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new ValidationError(`"${fieldName}" must be an array.`, { field: fieldName });
  }
  return value;
}

function capMessageLength(value, fieldName = 'message', max = LIMITS.MAX_MESSAGE_LENGTH) {
  if (value.length > max) {
    throw new ValidationError(`"${fieldName}" exceeds maximum length of ${max} characters.`, {
      field: fieldName,
      max,
      received: value.length,
    });
  }
  return value;
}

/**
 * Validates a chat-style message history array: [{ role, content }, ...]
 */
function validateHistory(history, fieldName = 'history') {
  if (history === undefined || history === null) return [];
  requireArray(history, fieldName);

  if (history.length > LIMITS.MAX_HISTORY_MESSAGES) {
    throw new ValidationError(
      `"${fieldName}" exceeds maximum of ${LIMITS.MAX_HISTORY_MESSAGES} messages.`,
      { field: fieldName, max: LIMITS.MAX_HISTORY_MESSAGES }
    );
  }

  history.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new ValidationError(`"${fieldName}[${index}]" must be an object.`, {
        field: `${fieldName}[${index}]`,
      });
    }
    requireString(entry.role, `${fieldName}[${index}].role`);
    requireString(entry.content, `${fieldName}[${index}].content`);
  });

  return history;
}

module.exports = {
  isNonEmptyString,
  requireString,
  requireOneOf,
  requireArray,
  capMessageLength,
  validateHistory,
};
