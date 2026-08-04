'use strict';

const { ConfigError } = require('./errors/AppError');
const { MODELS, VOICE, LIMITS } = require('./constants');

/**
 * MKJ AI Core - Configuration
 * -----------------------------------------------------------------------
 * The ONLY place in the AI Core that reads `process.env` directly.
 * Every provider/service must receive its settings from here, never
 * from process.env directly - this keeps the architecture testable and
 * keeps secrets out of business logic.
 *
 * This file does NOT throw at require-time. Validation is explicit via
 * `validateConfig()` / `requireProvider()` so that, e.g., a request that
 * only needs Gemini doesn't fail just because OPENROUTER_API_KEY is
 * missing. Call sites decide what they actually need.
 */

function readEnv(name, { required = false, fallback = undefined } = {}) {
  const value = process.env[name];
  if ((value === undefined || value === '') && required) {
    throw new ConfigError(`Missing required environment variable: ${name}`, { variable: name });
  }
  return value === undefined || value === '' ? fallback : value;
}

/**
 * Lazily built config object. Built once, cached, but nothing here throws
 * on module load - only on actual use of a missing value via the
 * `require*()` helpers below.
 */
const config = {
  env: readEnv('NODE_ENV', { fallback: 'production' }),

  providers: {
    gemini: {
      apiKey: readEnv('GEMINI_API_KEY'),
      defaultModel: MODELS.GEMINI.DEFAULT,
      proModel: MODELS.GEMINI.PRO,
      visionModel: MODELS.GEMINI.VISION,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    },
    openrouter: {
      apiKey: readEnv('OPENROUTER_API_KEY'),
      defaultModel: MODELS.OPENROUTER.DEFAULT,
      fallbackModel: MODELS.OPENROUTER.FALLBACK,
      baseUrl: 'https://openrouter.ai/api/v1',
      // OpenRouter asks that callers identify their app - harmless if unset.
      appUrl: readEnv('OPENROUTER_APP_URL', { fallback: 'https://mkjchat.app' }),
      appName: readEnv('OPENROUTER_APP_NAME', { fallback: 'MKJ Chat' }),
    },
  },

  search: {
    tavily: {
      apiKey: readEnv('TAVILY_API_KEY'),
      baseUrl: 'https://api.tavily.com',
      maxResults: LIMITS.MAX_SEARCH_RESULTS,
    },
  },

  voice: {
    elevenlabs: {
      apiKey: readEnv('ELEVENLABS_API_KEY'),
      baseUrl: 'https://api.elevenlabs.io/v1',
      defaultVoiceId: readEnv('ELEVENLABS_DEFAULT_VOICE_ID', {
        fallback: VOICE.ELEVENLABS_DEFAULT_VOICE_ID,
      }),
      defaultModel: VOICE.ELEVENLABS_DEFAULT_MODEL,
    },
    livekit: {
      apiKey: readEnv('LIVEKIT_API_KEY'),
      apiSecret: readEnv('LIVEKIT_API_SECRET'),
      wsUrl: readEnv('LIVEKIT_WS_URL', { fallback: '' }),
      defaultTtlSeconds: VOICE.LIVEKIT_DEFAULT_TTL_SECONDS,
    },
  },

  limits: LIMITS,

  /**
   * Default provider preference order per capability. Services use this
   * (via provider manager) unless the caller explicitly requests one.
   */
  defaults: {
    chatProvider: readEnv('AI_DEFAULT_CHAT_PROVIDER', { fallback: 'gemini' }),
    requestTimeoutMs: Number(readEnv('AI_REQUEST_TIMEOUT_MS', { fallback: String(LIMITS.DEFAULT_TIMEOUT_MS) })),
  },
};

/**
 * Validate that a specific provider's required env vars are present.
 * Throws ConfigError with a descriptive message if not.
 * @param {'gemini'|'openrouter'} providerName
 */
function requireProviderConfig(providerName) {
  const entry = config.providers[providerName];
  if (!entry) {
    throw new ConfigError(`Unknown provider: ${providerName}`);
  }
  if (!entry.apiKey) {
    throw new ConfigError(
      `Provider "${providerName}" is not configured. Missing API key in environment variables.`,
      { provider: providerName }
    );
  }
  return entry;
}

/**
 * Validate that Tavily search is configured.
 */
function requireSearchConfig() {
  if (!config.search.tavily.apiKey) {
    throw new ConfigError('Search is not configured. Missing TAVILY_API_KEY.');
  }
  return config.search.tavily;
}

/**
 * Validate that ElevenLabs voice synthesis is configured.
 */
function requireElevenLabsConfig() {
  if (!config.voice.elevenlabs.apiKey) {
    throw new ConfigError('Voice synthesis is not configured. Missing ELEVENLABS_API_KEY.');
  }
  return config.voice.elevenlabs;
}

/**
 * Validate that LiveKit is configured.
 */
function requireLiveKitConfig() {
  const { apiKey, apiSecret } = config.voice.livekit;
  if (!apiKey || !apiSecret) {
    throw new ConfigError('LiveKit is not configured. Missing LIVEKIT_API_KEY / LIVEKIT_API_SECRET.');
  }
  return config.voice.livekit;
}

/**
 * Report which optional subsystems are configured, without throwing.
 * Useful for a health-check endpoint / diagnostics.
 */
function getConfigStatus() {
  return {
    providers: {
      gemini: Boolean(config.providers.gemini.apiKey),
      openrouter: Boolean(config.providers.openrouter.apiKey),
    },
    search: {
      tavily: Boolean(config.search.tavily.apiKey),
    },
    voice: {
      elevenlabs: Boolean(config.voice.elevenlabs.apiKey),
      livekit: Boolean(config.voice.livekit.apiKey && config.voice.livekit.apiSecret),
    },
  };
}

module.exports = {
  config,
  requireProviderConfig,
  requireSearchConfig,
  requireElevenLabsConfig,
  requireLiveKitConfig,
  getConfigStatus,
};
