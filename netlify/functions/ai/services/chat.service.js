'use strict';

const { resolveProvider, getFallbackProvider } = require('../providers/provider.manager');
const { renderPrompt } = require('../prompts/prompt.loader');
const { requireString, validateHistory, capMessageLength } = require('../utils/validate');
const { ROLES, LIMITS, HTTP_STATUS } = require('../constants');
const { ProviderError } = require('../errors/AppError');
const imageService = require('./image.service');
const searchService = require('./search.service');
const logger = require('../utils/logger');

/**
 * MKJ AI Core - Chat Service
 * -----------------------------------------------------------------------
 * Orchestrates a chat completion request. This is where business logic
 * for "what does an AI chat turn look like" lives - prompt selection,
 * history assembly, provider selection - but it contains ZERO
 * provider-specific code. It only ever talks to the BaseProvider
 * interface via provider.manager.
 *
 * IMAGE REQUESTS: earlier versions of this file asked Gemini to decide
 * (via function-calling / tool-use) whether a message needed an image.
 * In practice Gemini narrated that decision in several different,
 * inconsistent, unparseable formats instead of using its tool reliably.
 * So that decision now lives in OUR code (looksLikeImageRequest, a
 * simple keyword check on the user's own message) - deterministic,
 * not dependent on the model's mood. Gemini is only asked, afterward,
 * to help write a good image prompt - a plain text reply, which it is
 * completely reliable at, unlike structured tool-calling here.
 */

/**
 * Whether a message reads as an image request.
 * @param {string} message
 * @returns {boolean}
 */
function looksLikeImageRequest(message) {
  return /\b(generate|create|draw|make|show|design|paint)\b.{0,15}\b(image|picture|photo|pic|drawing|illustration|artwork)\b/i.test(
    message
  );
}

/**
 * Whether a message reads as a web-search request - something needing
 * current/live information the model's own training data can't have
 * (news, prices, scores, "what's happening", etc.), as opposed to a
 * general-knowledge question the model can already answer on its own.
 * Deliberately narrow: false negatives (missing a search-worthy message)
 * just mean a normal chat answer, which is a safe fallback. False
 * positives would waste a Tavily call, so the pattern stays specific.
 * @param {string} message
 * @returns {boolean}
 */
function looksLikeSearchRequest(message) {
  return /\b(search( the web)?( for)?|look up|google)\b|\b(latest|current|recent|today'?s|this week'?s)\b.{0,20}\b(news|price|score|update|result|event|weather)\b|\bwho (won|is winning)\b|\bwhat(?:'?s| is) happening\b|\bwhat happened (today|yesterday|this week)\b/i.test(
    message
  );
}

/**
 * Run a Tavily search, then ask Gemini to turn the raw results into a
 * natural, cited chat answer - a plain text completion, same reliable
 * pattern as expandImagePrompt below. If Gemini fails, fall back to
 * Tavily's own built-in short answer rather than failing outright.
 * @param {string} message
 * @returns {Promise<string>}
 */
async function answerFromSearch(message) {
  const searchResult = await searchService.search({ query: message });

  const sourcesText = searchResult.results
    .slice(0, 5)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}\nSource: ${r.url}`)
    .join('\n\n');

  try {
    const provider = resolveProvider('gemini');
    const result = await provider.chatComplete({
      messages: [{ role: ROLES.USER, content: message }],
      systemPrompt: `Answer the user's question using ONLY the search results below. Be concise, natural, and conversational - this is a chat reply, not a report. Mention sources briefly where relevant (e.g. "according to..."), don't just list them.\n\nSearch results:\n${sourcesText}\n\nQuick answer if available: ${searchResult.answer || 'none'}`,
      temperature: 0.5,
      maxOutputTokens: 500,
    });
    const answer = (result.text || '').trim();
    return answer || searchResult.answer || "I searched but couldn't put together a clear answer - please try rephrasing.";
  } catch (err) {
    logger.warn('Search answer synthesis failed, using Tavily\'s own summary instead', {
      reason: err.message,
    });
    return searchResult.answer || "I found some results but couldn't summarize them just now - please try again.";
  }
}

/**
 * Ask Gemini to turn a short user request into a detailed image-generation
 * prompt - a plain text completion, not a tool call, so it doesn't hit
 * the same reliability problem. If this fails for any reason (quota,
 * network, etc.), we fall back to the user's own words rather than
 * failing the whole image request over a missing "nice-to-have" step.
 * @param {string} message
 * @returns {Promise<string>}
 */
async function expandImagePrompt(message) {
  try {
    const provider = resolveProvider('gemini');
    const result = await provider.chatComplete({
      messages: [{ role: ROLES.USER, content: message }],
      systemPrompt:
        'Rewrite the user\'s request as a single, vivid, detailed image-generation prompt (style, lighting, composition). Reply with ONLY the prompt text - no preamble, no quotes, no explanation, nothing else.',
      temperature: 0.6,
      maxOutputTokens: 200,
    });
    const expanded = (result.text || '').trim();
    return expanded || message;
  } catch (err) {
    logger.warn('Image prompt expansion failed, using the raw message instead', {
      reason: err.message,
    });
    return message;
  }
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
 * @returns {Promise<{type: 'text'|'image', text?: string, image?: object, prompt?: string, provider: string, model: string}>}
 */
async function generateChatResponse(params = {}) {
  const message = capMessageLength(requireString(params.message, 'message'), 'message', LIMITS.MAX_MESSAGE_LENGTH);
  const history = validateHistory(params.history, 'history');
  const promptId = params.promptId || 'chat';

  // Image intent is decided here, deterministically, BEFORE any provider
  // call - see the big comment at the top of this file for why.
  if (looksLikeImageRequest(message)) {
    logger.info('Message looks like an image request, routing to image generation', { message });
    const prompt = await expandImagePrompt(message);
    const image = await imageService.generateImage({ prompt });
    return {
      type: 'image',
      image,
      prompt,
      provider: image.provider,
      model: null,
    };
  }

  // Same deterministic-trigger pattern for search: our own code decides
  // if this needs current/live information, not the model. If Tavily
  // itself is unavailable, don't hard-fail the whole request - fall
  // through to a normal chat answer instead (imperfect, but better than
  // an error for something the model might partially know anyway).
  if (looksLikeSearchRequest(message)) {
    logger.info('Message looks like a search request, routing to web search', { message });
    try {
      const text = await answerFromSearch(message);
      return {
        type: 'text',
        text,
        provider: 'tavily+gemini',
        model: null,
      };
    } catch (err) {
      logger.warn('Web search failed entirely, falling through to a normal chat answer', {
        reason: err.message,
      });
    }
  }

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

    // Let a fallback failure propagate as-is - if both providers are
    // down, the caller should see a real error, not a swallowed one.
    result = await fallback.chatComplete(requestArgs);
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
