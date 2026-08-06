'use strict';

const { config } = require('../config');
const { IMAGE_PROVIDERS } = require('../constants');
const { ProviderError } = require('../errors/AppError');
const { withTimeout, withRetry } = require('../utils/async');
const logger = require('../utils/logger');

/**
 * Pollinations.ai image provider - free, keyless, no signup required.
 * Used as the fallback when Cloudflare is unavailable/rate-limited, so
 * image generation never fully dies even with zero budget.
 *
 * Follows the same small interface as cloudflare.provider.js:
 *   - isAvailable(): boolean
 *   - generateImage({ prompt }): Promise<{ provider, base64, mimeType }>
 */
class PollinationsImageProvider {
  constructor() {
    this.name = IMAGE_PROVIDERS.POLLINATIONS;
  }

  // eslint-disable-next-line class-methods-use-this
  isAvailable() {
    // Keyless - always considered available.
    return true;
  }

  async generateImage({ prompt }) {
    const { baseUrl } = config.image.pollinations;
    // A random seed keeps repeated identical prompts from hitting a
    // cached/stale image; nologo strips Pollinations' watermark.
    const seed = Math.floor(Math.random() * 1_000_000);
    const url = `${baseUrl}/prompt/${encodeURIComponent(prompt)}?nologo=true&seed=${seed}`;

    const requestFn = async () => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new ProviderError(`Pollinations API error (${res.status})`, { status: res.status });
      }
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer).toString('base64');
    };

    let base64;
    try {
      base64 = await withRetry(
        () => withTimeout(requestFn(), config.defaults.requestTimeoutMs, 'Pollinations generateImage'),
        {
          retries: 1,
          shouldRetry: (err) => !(err instanceof ProviderError) || err.details?.status >= 500,
        }
      );
    } catch (err) {
      logger.error('Pollinations image provider request failed', { err });
      if (err instanceof ProviderError) throw err;
      throw new ProviderError('Failed to reach Pollinations', null, err);
    }

    return {
      provider: this.name,
      base64,
      mimeType: 'image/jpeg',
    };
  }
}

module.exports = PollinationsImageProvider;
