'use strict';

const { TimeoutError } = require('../errors/AppError');

/**
 * Wrap a promise with a timeout. Rejects with TimeoutError if the promise
 * does not settle in time.
 * @param {Promise<*>} promise
 * @param {number} ms
 * @param {string} [label]
 * @returns {Promise<*>}
 */
function withTimeout(promise, ms, label = 'operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Retry an async function with exponential backoff.
 * @param {() => Promise<*>} fn
 * @param {object} [options]
 * @param {number} [options.retries=2]
 * @param {number} [options.baseDelayMs=300]
 * @param {(err: Error, attempt: number) => boolean} [options.shouldRetry] - Return false to stop retrying.
 * @returns {Promise<*>}
 */
async function withRetry(fn, options = {}) {
  const { retries = 2, baseDelayMs = 300, shouldRetry = () => true } = options;

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      const isLastAttempt = attempt === retries;
      if (isLastAttempt || !shouldRetry(err, attempt)) {
        throw err;
      }
      const delay = baseDelayMs * 2 ** attempt;
      // eslint-disable-next-line no-await-in-loop
      await sleep(delay);
    }
  }
  throw lastErr;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parse JSON, returning a fallback instead of throwing.
 * @param {string} raw
 * @param {*} [fallback=null]
 */
function safeJsonParse(raw, fallback = null) {
  try {
    return JSON.parse(raw);
  } catch (_err) {
    return fallback;
  }
}

module.exports = {
  withTimeout,
  withRetry,
  sleep,
  safeJsonParse,
};
