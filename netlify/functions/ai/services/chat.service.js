'use strict';

const { resolveProvider, getFallbackProvider } = require('../providers/provider.manager');
const { renderPrompt } = require('../prompts/prompt.loader');
const { requireString, validateHistory, capMessageLength } = require('../utils/validate');
const { ROLES, LIMITS, HTTP_STATUS } = require('../constants');
const { ProviderError } = require('../errors/AppError');
const logger = require('../utils/logger');

/**
 * Whether a failure from a provider is the kind that's worth retrying on
 * a DIFFERENT provider (rate limit / quota / that provider being down),
 * as opposed to something that would fail identically everywhere (bad
 * input, etc).
 * @param {Error} err
 * @returns {boolean}
 */
function isFallbackWorthy(err) {
  if (!(err instanceof ProviderError)) return false;
  const status = err.details?.status;
  return (
    status === HTTP_STATUS.TOO_MANY_REQUESTS ||
    status === HTTP_STATUS.SERVICE_UNAVAILABLE ||
    status === HTTP_STATUS.BAD_GATEWAY ||
    status >= 500
  );
}

/**
 * MKJ AI Core - Chat Service
 * -----------------------------------------------------------------------
 * Orchestrates a chat completion request. This is where business logic
 * for "what does an AI chat turn look like" lives - prompt selection,
 * history assembly, provider selection - but it contains ZERO
 * provider-specific code. It only ever talks to the BaseProvider
 * interface via provider.manager.
 *
 * This service is entirely new and independent of any existing chat or
 * translation code in the current backend.
 */

/**
 * Generate an AI chat response.
 * @param {object} params
 * @param {string} params.message - The new user message.
 * @param {Array<import('../types').ChatMessage>} [params.history] - Prior turns, oldest first.
 * @param {string} [params.provider] - Explicit provider name override.
 * @param {string} [params.model] - Explicit model override.
 * @param {string} [params.promptId='chat'] - Which system prompt to use.
 * @param {object} [params.promptContext] - Context passed to the prompt renderer.
 * @param {number} [params.temperature]
 * @param {number} [params.maxOutputTokens]
 * @returns {Promise<import('../types').ChatCompletionResult>}
 */
async function generateChatResponse(params = {}) {
  const message = capMessageLength(requireString(params.message, 'message'), 'message', LIMITS.MAX_MESSAGE_LENGTH);
  const history = validateHistory(params.history, 'history');
  const promptId = params.promptId || 'chat';

  const systemPrompt = renderPrompt(promptId, params.promptContext || {});

  const messages = [...history, { role: ROLES.USER, content: message }];

  const provider = resolveProvider(params.provider);

  logger.info('Chat request', {
    provider: provider.name,
    historyLength: history.length,
    promptId,
  });

  const requestArgs = {
    messages,
    model: params.model,
    temperature: params.temperature,
    maxOutputTokens: params.maxOutputTokens,
    systemPrompt,
  };

  try {
    return await provider.chatComplete(requestArgs);
  } catch (err) {
    // Only auto-fallback when the caller didn't explicitly request a
    // specific provider (params.provider), and only for failures that
    // indicate THIS provider is having trouble right now (rate limit,
    // outage) rather than an error that would happen on any provider.
    if (params.provider || !isFallbackWorthy(err)) {
      throw err;
    }

    const fallback = getFallbackProvider(provider.name);
    if (!fallback) {
      logger.warn('Primary provider failed and no fallback is configured', {
        failedProvider: provider.name,
      });
      throw err;
    }

    logger.warn('Primary provider failed, retrying with fallback provider', {
      failedProvider: provider.name,
      fallbackProvider: fallback.name,
      reason: err.message,
    });

    // Let a fallback failure propagate as-is - if both providers are
    // down, the caller should see a real error, not a swallowed one.
    return await fallback.chatComplete(requestArgs);
  }
}

module.exports = {
  generateChatResponse,
};
