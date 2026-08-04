'use strict';

const { HTTP_STATUS, ERROR_CODES } = require('../constants');

/**
 * Base error class for the MKJ AI Core.
 * All custom errors in this module extend this class so the error
 * middleware can handle them uniformly.
 */
class AppError extends Error {
  /**
   * @param {string} message - Human readable message (safe to show to client).
   * @param {object} [options]
   * @param {number} [options.statusCode=500] - HTTP status code.
   * @param {string} [options.code=ERROR_CODES.INTERNAL_ERROR] - Machine readable error code.
   * @param {object|null} [options.details=null] - Extra structured context (validation fields, etc).
   * @param {boolean} [options.isOperational=true] - Whether this is a known/expected error.
   * @param {Error|null} [options.cause=null] - Original error, if wrapping.
   */
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = options.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    this.code = options.code || ERROR_CODES.INTERNAL_ERROR;
    this.details = options.details || null;
    this.isOperational = options.isOperational !== undefined ? options.isOperational : true;
    this.cause = options.cause || null;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        details: this.details,
        timestamp: this.timestamp,
      },
    };
  }
}

class ValidationError extends AppError {
  constructor(message = 'Invalid request', details = null) {
    super(message, {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: ERROR_CODES.VALIDATION_ERROR,
      details,
    });
  }
}

class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, {
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: ERROR_CODES.AUTH_ERROR,
    });
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, {
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests', details = null) {
    super(message, {
      statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
      code: ERROR_CODES.RATE_LIMITED,
      details,
    });
  }
}

class ProviderError extends AppError {
  constructor(message = 'AI provider error', details = null, cause = null) {
    super(message, {
      statusCode: HTTP_STATUS.BAD_GATEWAY,
      code: ERROR_CODES.PROVIDER_ERROR,
      details,
      cause,
    });
  }
}

class ProviderUnavailableError extends AppError {
  constructor(message = 'AI provider unavailable', details = null) {
    super(message, {
      statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
      code: ERROR_CODES.PROVIDER_UNAVAILABLE,
      details,
    });
  }
}

class ConfigError extends AppError {
  constructor(message = 'Configuration error', details = null) {
    super(message, {
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.CONFIG_ERROR,
      details,
      isOperational: false,
    });
  }
}

class UnsupportedActionError extends AppError {
  constructor(action) {
    super(`Unsupported action: ${action}`, {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: ERROR_CODES.UNSUPPORTED_ACTION,
      details: { action },
    });
  }
}

class TimeoutError extends AppError {
  constructor(message = 'Request timed out', details = null) {
    super(message, {
      statusCode: HTTP_STATUS.GATEWAY_TIMEOUT,
      code: ERROR_CODES.TIMEOUT,
      details,
    });
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthError,
  NotFoundError,
  RateLimitError,
  ProviderError,
  ProviderUnavailableError,
  ConfigError,
  UnsupportedActionError,
  TimeoutError,
};
