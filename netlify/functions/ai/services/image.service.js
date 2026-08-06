'use strict';

const CloudflareImageProvider = require('../providers/cloudflare.provider');
const PollinationsImageProvider = require('../providers/pollinations.provider');
const { requireString, capMessageLength } = require('../utils/validate');
const logger = require('../utils/logger');

/**
 * MKJ AI Core - Image Service
 * -----------------------------------------------------------------------
 * Orchestrates image generation: Cloudflare Workers AI (FLUX) is
 * primary, Pollinations is the always-available, keyless fallback.
 * Mirrors the reliability pattern used in chat.service.js (primary
 * provider, automatic fallback on failure) and translate.js (Gemini ->
 * MyMemory) elsewhere in this app - same philosophy, applied here.
 */

const cloudflareProvider = new CloudflareImageProvider();
const pollinationsProvider = new PollinationsImageProvider();

const MAX_PROMPT_LENGTH = 800;

/**
 * Generate an image from a text prompt.
 * @param {object} params
 * @param {string} params.prompt - Description of the image to generate.
 * @returns {Promise<{provider: string, base64: string, mimeType: string}>}
 */
async function generateImage(params = {}) {
  const prompt = capMessageLength(requireString(params.prompt, 'prompt'), 'prompt', MAX_PROMPT_LENGTH);

  if (cloudflareProvider.isAvailable()) {
    try {
      logger.info('Image request', { provider: cloudflareProvider.name });
      return await cloudflareProvider.generateImage({ prompt });
    } catch (err) {
      logger.warn('Cloudflare image generation failed, falling back to Pollinations', {
        reason: err.message,
      });
    }
  } else {
    logger.warn('Cloudflare not configured, using Pollinations directly');
  }

  // Pollinations is keyless/always available - if this also fails, let
  // the error propagate as a real failure rather than swallowing it.
  logger.info('Image request', { provider: pollinationsProvider.name });
  return pollinationsProvider.generateImage({ prompt });
}

module.exports = {
  generateImage,
};
