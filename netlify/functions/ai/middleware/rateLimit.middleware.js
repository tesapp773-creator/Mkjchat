'use strict';

const { RateLimitError } = require('../errors/AppError');
const logger = require('../utils/logger');

/**
 * MKJ AI Core - Rate Limit Middleware
 * -----------------------------------------------------------------------
 * Netlify Functions are stateless/ephemeral, so a truly correct
 * distributed rate limiter needs an external store (Firestore, Redis,
 * etc). This module provides:
 *
 *   1. A best-effort IN-MEMORY limiter that works within a single warm
 *      function instance (helps against rapid-fire abuse in a burst,
 *      not a full guarantee across cold starts/instances).
 *   2. A clean `store` interface so a Firestore-backed (or other)
 *      distributed limiter can be swapped in later WITHOUT touching
 *      any service or router code - just replace `checkAndConsume`.
 *
 * This does NOT touch Firebase. Wiring a Firestore-backed store later
 * is an explicit opt-in change to this file only.
 */

const buckets = new Map(); // key -> { count, windowStart }

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_REQUESTS = 20;

/**
 * Check and consume one unit of rate-limit budget for a given key.
 * Throws RateLimitError if the caller has exceeded the limit.
 *
 * @param {string} key - Typically the authenticated uid, or an IP as fallback.
 * @param {object} [options]
 * @param {number} [options.windowMs=60000]
 * @param {number} [options.maxRequests=20]
 */
function checkAndConsume(key, options = {}) {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests || DEFAULT_MAX_REQUESTS;
  const now = Date.now();

  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return;
  }

  if (bucket.count >= maxRequests) {
    const retryAfterMs = windowMs - (now - bucket.windowStart);
    logger.warn('AI Core rate limit exceeded', { key, maxRequests, windowMs });
    throw new RateLimitError('Rate limit exceeded. Please slow down.', {
      retryAfterMs,
    });
  }

  bucket.count += 1;
}

/**
 * Periodically prune old buckets so memory doesn't grow unbounded across
 * a long-lived warm function instance.
 */
function pruneStaleBuckets(maxAgeMs = 10 * 60 * 1000) {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.windowStart > maxAgeMs) {
      buckets.delete(key);
    }
  }
}

module.exports = {
  checkAndConsume,
  pruneStaleBuckets,
};
