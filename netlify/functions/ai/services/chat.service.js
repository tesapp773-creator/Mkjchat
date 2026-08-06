'use strict';

const { resolveProvider, getFallbackProvider } = require('../providers/provider.manager');
const { renderPrompt } = require('../prompts/prompt.loader');
const { requireString, validateHistory, capMessageLength } = require('../utils/validate');
const { ROLES, LIMITS, HTTP_STATUS, PROVIDERS } = require('../constants');
const { ProviderError } = require('../errors/AppError');
const imageService = require('./image.service');
const logger = require('../utils/logger');

/**
 * Gemini function-calling tool declaration for image generation. Passing
 * this lets Gemini itself decide - from the natural language of the
 * message - whether the user is asking for an image, rather than the
 * backend matching keywords or a "/image" command prefix.
 */
const IMAGE_TOOL = [
  {
    functionDeclarations: [
      {
        name: 'generate_image',
        description:
          'Generate an image from a text description. Call this whenever the user asks to see, create, draw, generate, or make a picture/image/photo of something.',
        parameters: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'A clear, detailed description of the image to generate.',
            },
          },
          required: ['prompt'],
        },
      },
    ],
  },
];

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
 * @param {boolean} [params.enableImageTool=true] - Whether Gemini may
 *   choose to call the image-generation tool for this message.
 * @returns {Promise<{type: 'text'|'image', text?: string, image?: object, prompt?: string, provider: string, model: string}>}
 */
async function generateChatResponse(params = {}) {
  const message = capMessageLength(requireString(params.message, 'message'), 'message', LIMITS.MAX_MESSAGE_LENGTH);
  const history = validateHistory(params.history, 'history');
  const promptId = params.promptId || 'chat';
  const enableImageTool = params.enableImageTool !== false;

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
    // Only Gemini's provider implements function-calling here - passing
    // this to OpenRouter would just be ignored by that provider's
    // request-building code, but we gate it explicitly for clarity.
    tools: enableImageTool && provider.name === PROVIDERS.GEMINI ? IMAGE_TOOL : null,
  };

  let result;
  try {
    result = await provider.chatComplete(requestArgs);
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

    // Fallback provider doesn't get the image tool - image generation via
    // natural-language detection is a Gemini-specific path for now. A
    // fallback failure propagates as-is; the caller should see a real
    // error rather than a swallowed one.
    result = await fallback.chatComplete({ ...requestArgs, tools: null });
  }

  if (result.functionCall && result.functionCall.name === 'generate_image') {
    const prompt = result.functionCall.args?.prompt || message;
    logger.info('Chat request resolved to image generation', { prompt });
    const image = await imageService.generateImage({ prompt });
    return {
      type: 'image',
      image,
      prompt,
      provider: result.provider,
      model: result.model,
    };
  }

  return {
    type: 'text',
    text: result.text,
    provider: result.provider,
    model: result.model,
  };
}

module.exports = {
  generateChatResponse,
};
