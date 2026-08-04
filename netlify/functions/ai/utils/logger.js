'use strict';

/**
 * MKJ AI Core - Logger
 * -----------------------------------------------------------------------
 * A tiny structured logger. Console-based today, but every log call goes
 * through `emit()` so a future monitoring backend (Sentry, Datadog,
 * Logtail, a Firestore "ai_logs" collection, etc.) can be plugged in by
 * changing ONLY this file - no call sites need to change.
 *
 * Usage:
 *   const logger = require('../utils/logger');
 *   logger.info('Chat request received', { userId, action });
 *   logger.error('Provider failed', { provider: 'gemini', err });
 */

const LEVELS = Object.freeze({
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
});

/**
 * Hook registry. Future monitoring integrations register themselves here
 * via `logger.addSink(fn)` without touching the rest of the codebase.
 * @type {Array<(entry: object) => void>}
 */
const sinks = [];

/**
 * Register an additional log sink (e.g. send to an external service).
 * Sink errors are swallowed so logging never crashes the request.
 * @param {(entry: object) => void} sinkFn
 */
function addSink(sinkFn) {
  if (typeof sinkFn === 'function') {
    sinks.push(sinkFn);
  }
}

function serializeMeta(meta) {
  if (!meta) return {};
  const out = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value instanceof Error) {
      out[key] = { message: value.message, stack: value.stack };
    } else {
      out[key] = value;
    }
  }
  return out;
}

function emit(level, message, meta) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'mkj-ai-core',
    ...serializeMeta(meta),
  };

  const line = JSON.stringify(entry);

  switch (level) {
    case LEVELS.ERROR:
      // eslint-disable-next-line no-console
      console.error(line);
      break;
    case LEVELS.WARN:
      // eslint-disable-next-line no-console
      console.warn(line);
      break;
    default:
      // eslint-disable-next-line no-console
      console.log(line);
  }

  for (const sink of sinks) {
    try {
      sink(entry);
    } catch (_sinkErr) {
      // Never let a broken sink break the request.
    }
  }
}

module.exports = {
  LEVELS,
  addSink,
  debug: (message, meta) => emit(LEVELS.DEBUG, message, meta),
  info: (message, meta) => emit(LEVELS.INFO, message, meta),
  warn: (message, meta) => emit(LEVELS.WARN, message, meta),
  error: (message, meta) => emit(LEVELS.ERROR, message, meta),
};
