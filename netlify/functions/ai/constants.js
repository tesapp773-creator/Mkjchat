'use strict';

/**
 * MKJ AI Core - Constants
 * -----------------------------------------------------------------------
 * Single source of truth for enums / fixed values used across the AI
 * architecture. Nothing here reads env vars (that belongs in config.js).
 */

const PROVIDERS = Object.freeze({
  GEMINI: 'gemini',
  OPENROUTER: 'openrouter',
});

const ACTIONS = Object.freeze({
  CHAT: 'chat',
  SEARCH: 'search',
  VOICE_SYNTHESIZE: 'voice.synthesize',
  VOICE_TOKEN: 'voice.token',
  MEMORY_GET: 'memory.get',
  MEMORY_APPEND: 'memory.append',
  MEMORY_CLEAR: 'memory.clear',
  HEALTH: 'health',
});

const SERVICE_NAMES = Object.freeze({
  CHAT: 'chat.service',
  SEARCH: 'search.service',
  VOICE: 'voice.service',
  MEMORY: 'memory.service',
});

const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
});

const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'AI_VALIDATION_ERROR',
  AUTH_ERROR: 'AI_AUTH_ERROR',
  NOT_FOUND: 'AI_NOT_FOUND',
  RATE_LIMITED: 'AI_RATE_LIMITED',
  PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  PROVIDER_UNAVAILABLE: 'AI_PROVIDER_UNAVAILABLE',
  CONFIG_ERROR: 'AI_CONFIG_ERROR',
  INTERNAL_ERROR: 'AI_INTERNAL_ERROR',
  UNSUPPORTED_ACTION: 'AI_UNSUPPORTED_ACTION',
  TIMEOUT: 'AI_TIMEOUT',
});

// Default model identifiers. Kept here (not config.js) because these are
// fixed catalog values, not environment-provided. config.js may override
// via env if needed in the future.
const MODELS = Object.freeze({
  GEMINI: {
    DEFAULT: 'gemini-2.0-flash',
    PRO: 'gemini-2.0-pro',
    VISION: 'gemini-2.0-flash',
  },
  OPENROUTER: {
    // 'openrouter/free' is OpenRouter's own auto-router: it picks
    // whichever currently-free model fits the request, at zero cost,
    // no billing required. Free-tier specific model IDs (e.g. ending in
    // ':free') rotate in and out of OpenRouter's catalog frequently, so
    // hardcoding one is fragile - the auto-router avoids that problem.
    DEFAULT: 'openrouter/free',
    FALLBACK: 'openrouter/free',
  },
});

const VOICE = Object.freeze({
  ELEVENLABS_DEFAULT_VOICE_ID: '21m00Tcm4TlvDq8ikWAM', // "Rachel" - safe default
  ELEVENLABS_DEFAULT_MODEL: 'eleven_multilingual_v2',
  LIVEKIT_DEFAULT_TTL_SECONDS: 60 * 10, // 10 minutes
});

const LIMITS = Object.freeze({
  MAX_MESSAGE_LENGTH: 8000,
  MAX_HISTORY_MESSAGES: 40,
  MAX_SEARCH_RESULTS: 10,
  DEFAULT_TIMEOUT_MS: 30000,
  MAX_RETRIES: 2,
});

const ROLES = Object.freeze({
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
});

module.exports = {
  PROVIDERS,
  ACTIONS,
  SERVICE_NAMES,
  HTTP_STATUS,
  ERROR_CODES,
  MODELS,
  VOICE,
  LIMITS,
  ROLES,
};
