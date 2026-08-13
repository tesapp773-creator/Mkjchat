'use strict';

const GeminiProvider = require('../providers/gemini.provider');
const GroqVisionProvider = require('../providers/groq-vision.provider');
const { requireString } = require('../utils/validate');
const { ProviderError } = require('../errors/AppError');
const logger = require('../utils/logger');

/**
 * MKJ AI Core - Vision Service
 * -----------------------------------------------------------------------
 * Orchestrates "describe/answer a question about an image the user
 * sent": fetch the image bytes from its URL (Cloudinary, in this app),
 * ask Gemini to look at it, and fall back to Groq's vision model if
 * Gemini fails. Same primary/fallback pattern as every other AI feature
 * in this app - Gemini first, a free alternative as the safety net.
 */

const geminiProvider = new GeminiProvider();
const groqVisionProvider = new GroqVisionProvider();

const MAX_QUESTION_LENGTH = 2000;
const DEFAULT_QUESTION = 'Describe what is in this image in a friendly, conversational way.';

/**
 * Whether a provider failure is worth retrying on the fallback vision
 * provider. Fixed 2026-08-13, same reasoning as chat.service.js's
 * isFallbackWorthy: narrowing this to specific status codes meant an
 * unexpected failure (e.g. a provider retiring a model name, which
 * surfaces as a 404) would fall through Groq entirely even though it
 * was working - exactly what just happened with gemini-2.0-flash on
 * the chat path. Vision uses the same underlying Gemini model, so it
 * was equally exposed to this. Any ProviderError now falls back.
 * @param {Error} err
 * @returns {boolean}
 */
function isFallbackWorthy(err) {
  return err instanceof ProviderError;
}

/**
 * Fetch an image from a URL (Cloudinary, in this app) and return it as
 * base64 + its mime type, ready to hand to a vision model.
 * @param {string} imageUrl
 * @returns {Promise<{base64: string, mimeType: string}>}
 */
async function fetchImageAsBase64(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new ProviderError(`Failed to fetch image (${res.status})`, { status: res.status, imageUrl });
  }
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return { base64, mimeType: contentType.split(';')[0].trim() };
}

/**
 * Describe/answer a question about an image.
 * @param {object} params
 * @param {string} params.imageUrl - URL of the image (already uploaded to Cloudinary by the frontend).
 * @param {string} [params.question] - What the user asked. Defaults to a general "describe this" prompt.
 * @returns {Promise<{type: 'text', text: string, provider: string}>}
 */
async function describeImage(params = {}) {
  const imageUrl = requireString(params.imageUrl, 'imageUrl');
  const question = params.question && params.question.trim()
    ? params.question.trim().slice(0, MAX_QUESTION_LENGTH)
    : DEFAULT_QUESTION;

  const { base64, mimeType } = await fetchImageAsBase64(imageUrl);

  try {
    logger.info('Vision request', { provider: 'gemini' });
    const result = await geminiProvider.describeImage({ imageBase64: base64, mimeType, question });
    return { type: 'text', text: result.text, provider: result.provider };
  } catch (err) {
    if (!isFallbackWorthy(err)) throw err;

    logger.warn('Gemini vision failed, falling back to Groq', { reason: err.message });

    if (!groqVisionProvider.isAvailable()) {
      logger.warn('Groq vision not configured, cannot fall back');
      throw err;
    }

    logger.info('Vision request', { provider: 'groq' });
    const fallbackResult = await groqVisionProvider.describeImage({ imageBase64: base64, mimeType, question });
    return { type: 'text', text: fallbackResult.text, provider: fallbackResult.provider };
  }
}

module.exports = {
  describeImage,
};
