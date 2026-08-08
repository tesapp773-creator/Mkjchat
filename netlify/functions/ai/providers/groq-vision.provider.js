'use strict';

const { config, requireGroqConfig } = require('../config');
const { VISION_PROVIDERS } = require('../constants');
const { ProviderError } = require('../errors/AppError');
const { withTimeout, withRetry } = require('../utils/async');
const logger = require('../utils/logger');

/**
 * Groq vision provider - fallback for describing/answering questions
 * about images, used when Gemini's vision call fails. Groq's vision
 * models are labeled "Preview" by Groq itself (not fully committed
 * long-term), so this is a real but honestly-flagged risk - see the
 * comment in vision.service.js for how that's handled operationally.
 *
 * Uses Groq's OpenAI-compatible chat completions endpoint. Follows the
 * same standalone-interface pattern as the image generation providers
 * (isAvailable/describeImage) rather than extending BaseProvider, since
 * this isn't a text chat provider.
 */
class GroqVisionProvider {
  constructor() {
    this.name = VISION_PROVIDERS.GROQ;
  }

  isAvailable() {
    return Boolean(config.providers.groq.apiKey);
  }

  /**
   * @param {object} params
   * @param {string} params.imageBase64 - Base64-encoded image data (no data: prefix).
   * @param {string} params.mimeType - e.g. 'image/jpeg', 'image/png'.
   * @param {string} params.question - What the user asked about the image.
   * @returns {Promise<{provider: string, text: string}>}
   */
  async describeImage({ imageBase64, mimeType, question }) {
    const providerConfig = requireGroqConfig();
    const url = `${providerConfig.baseUrl}/chat/completions`;

    const requestFn = async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${providerConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: providerConfig.visionModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
                { type: 'text', text: question },
              ],
            },
          ],
          temperature: 0.4,
          max_tokens: 800,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new ProviderError(`Groq vision API error (${res.status})`, {
          status: res.status,
          body: errText,
        });
      }

      return res.json();
    };

    let raw;
    try {
      raw = await withRetry(
        () => withTimeout(requestFn(), config.defaults.requestTimeoutMs, 'Groq describeImage'),
        {
          retries: 1,
          shouldRetry: (err) => !(err instanceof ProviderError) || err.details?.status >= 500,
        }
      );
    } catch (err) {
      logger.error('Groq vision request failed', { err });
      if (err instanceof ProviderError) throw err;
      throw new ProviderError('Failed to reach Groq vision API', null, err);
    }

    const text = raw?.choices?.[0]?.message?.content || '';

    return {
      provider: this.name,
      text,
    };
  }
}

module.exports = GroqVisionProvider;
