'use strict';

const { ValidationError } = require('../errors/AppError');
const { safeJsonParse } = require('./async');

/**
 * Parse a Netlify Function event body into a JS object.
 * Handles base64-encoded bodies (e.g. some proxies/clients encode them).
 * @param {object} event - Netlify event object.
 * @returns {object}
 */
function parseBody(event) {
  if (!event || !event.body) return {};

  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  const parsed = safeJsonParse(raw, undefined);
  if (parsed === undefined) {
    throw new ValidationError('Request body must be valid JSON.');
  }
  return parsed || {};
}

/**
 * Extract a Bearer token from the Authorization header, if present.
 * @param {object} event
 * @returns {string|null}
 */
function getBearerToken(event) {
  const headers = (event && event.headers) || {};
  const authHeader = headers.authorization || headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;

  const [scheme, token] = authHeader.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token;
}

module.exports = {
  parseBody,
  getBearerToken,
};
