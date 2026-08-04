'use strict';

const { HTTP_STATUS } = require('../constants');

/**
 * Standard CORS/JSON headers. Kept minimal and additive so it never
 * conflicts with headers the existing backend already sets elsewhere.
 */
function baseHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    ...extra,
  };
}

/**
 * Build a successful Netlify Function response.
 * @param {*} data - Payload to return under `data`.
 * @param {object} [options]
 * @param {number} [options.statusCode=200]
 * @param {object} [options.meta] - Optional extra metadata (e.g. requestId, provider used).
 */
function success(data, options = {}) {
  const { statusCode = HTTP_STATUS.OK, meta = {} } = options;
  return {
    statusCode,
    headers: baseHeaders(),
    body: JSON.stringify({
      success: true,
      data,
      meta,
    }),
  };
}

/**
 * Build a response for CORS preflight (OPTIONS) requests.
 */
function noContent() {
  return {
    statusCode: HTTP_STATUS.NO_CONTENT,
    headers: baseHeaders(),
    body: '',
  };
}

module.exports = {
  baseHeaders,
  success,
  noContent,
};
