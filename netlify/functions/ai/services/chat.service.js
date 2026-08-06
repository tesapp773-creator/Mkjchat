'use strict';

const { resolveProvider, getFallbackProvider } = require('../providers/provider.manager');
const { renderPrompt } = require('../prompts/prompt.loader');
const { requireString, validateHistory, capMessageLength } = require('../utils/validate');
const { safeJsonParse } = require('../utils/async');
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
 * Some Gemini responses "narrate" a tool call as plain JSON text instead
 * of using the API's native structured functionCall mechanism - e.g.
 * replying with `{"tool": "generate_image", "arguments": {"prompt": "..."}}`
 * as the message body. This is a fallback net that catches that pattern
 * so image generation still works even when Gemini expresses the call
 * this way rather than natively. Handles the text being wrapped in a
 * markdown code fence too, since that's another common variant.
 * @param {string} text
 * @returns {{name: string, args: object}|null}
 */
function detectImageCallInText(text) {
  if (!text) return null;
  const stripped = text.trim().replace(/^```json\s*|^```\s*|```$/g, '').trim();
  if (!stripped.startsWith('{')) return null;

  const parsed = safeJsonParse(stripped, null);
  if (!parsed || typeof parsed !== 'object') return null;

  // Accept a couple of shapes models commonly narrate in.
  const toolName = parsed.tool || parsed.name || parsed.function;
  if (toolName !== 'generate_image') return null;

  const prompt = parsed.arguments?.prompt || parsed.args?.prompt || parsed.parameters?.prompt;
  if (!prompt) return null;

  return { name: 'generate_image', args: { prompt } };
}

/**
 * Cheap guard so detectImageRefusalInText only fires on messages that
 * actually look like an image request in the first place - otherwise a
 * completely unrelated conversation that happens to mention "DALL-E" or
 * "I can't generate" (e.g. "what's the difference between DALL-E and
 * Midjourney?") would incorrectly get treated as an image request.
 * @param {string} message
 * @returns {boolean}
 */
function looksLikeImageRequest(message) {
  return /\b(generate|create|draw|make|show|design)\b.{0,15}\b(image|picture|photo|pic|drawing|illustration|artwork)\b/i.test(
    message
  );
}

/**
 * Some Gemini responses fall back to its trained "I can't generate
 * images, but here's a prompt you can paste into DALL-E/Midjourney"
 * behavior instead of using the tool - even though it just wrote a
 * perfectly good, detailed image prompt in the process. Rather than
 * showing the user that refusal (which is exactly what we don't want -
 * this app generates the image itself, it never hands the user off to
 * another tool), this detects that pattern and pulls the prompt Gemini
 * already wrote back out, so the image still gets generated silently.
 *
 * Only called when the user's ORIGINAL message already looks like an
 * image request (see looksLikeImageRequest) - this guards against
 * misfiring on an unrelated conversation that happens to mention an
 * image-tool's name or the phrase "can't generate".
 * @param {string} text
 * @param {string} originalMessage - The user's own message, used as a
 *   fallback prompt if no usable prompt can be extracted from the text.
 * @returns {{name: string, args: object}|null}
 */
function detectImageRefusalInText(text, originalMessage) {
  if (!text || !looksLikeImageRequest(originalMessage)) return null;

  const mentionsExternalTool = /\b(DALL-?E|Midjourney|Stable Diffusion|image[- ]?generator)\b/i.test(text);
  const claimsCantGenerate = /\b(I can'?t|I'?m unable to|I don'?t have the ability to)\b.{0,40}\b(generate|create|produce|make)\b.{0,20}\bimage/i.test(
    text
  );
  if (!mentionsExternalTool && !claimsCantGenerate) return null;

  // Try to pull out a prompt Gemini already wrote, e.g. after a
  // "**Prompt:**" label, or inside the first *asterisk-wrapped* or
  // "quoted" block - covers the common ways it formats this.
  const labelMatch = text.match(/\*{0,2}prompt:?\*{0,2}\s*\n*\*?"?([^\n*"]{15,400})/i);
  const extractedPrompt = labelMatch ? labelMatch[1].trim() : null;

  return { name: 'generate_image', args: { prompt: extractedPrompt || originalMessage } };
}

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
    // Lower temperature specifically when the image tool is offered:
    // Gemini follows an explicit "use this tool" instruction far more
    // consistently at lower randomness. A caller-supplied temperature
    // always wins - this only fills in a better default.
    temperature: params.temperature ?? (enableImageTool && provider.name === PROVIDERS.GEMINI ? 0.3 : 0.7),
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

  const functionCall =
    result.functionCall || detectImageCallInText(result.text) || detectImageRefusalInText(result.text, message);

  if (functionCall && functionCall.name === 'generate_image') {
    const prompt = functionCall.args?.prompt || message;
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
