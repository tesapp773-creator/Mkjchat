'use strict';

const { config, requireCloudflareImageConfig } = require('../config');
const { IMAGE_PROVIDERS } = require('../constants');
const { ProviderError } = require('../errors/AppError');
const { withTimeout, withRetry } = require('../utils/async');
const logger = require('../utils/logger');

/**
 * Cloudflare Workers AI - FLUX.1 [schnell] image provider.
 *
 * This is intentionally NOT a BaseProvider subclass - image generation
 * has a different normalized shape (base64 image, not chat text), so it
 * follows its own small, self-documented interface:
 *   - isAvailable(): boolean
 *   - generateImage({ prompt }): Promise<{ provider, base64, mimeType }>
 */
class CloudflareImageProvider {
  constructor() {
    this.name = IMAGE_PROVIDERS.CLOUDFLARE;
  }

  isAvailable() {
    return Boolean(config.image.cloudflare.apiToken && config.image.cloudflare.accountId);
  }

  async generateImage({ prompt }) {
    const providerConfig = requireCloudflareImageConfig();
    const url = `${providerConfig.baseUrl}/${providerConfig.accountId}/ai/run/${providerConfig.model}`;

    const requestFn = async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${providerConfig.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new ProviderError(`Cloudflare Workers AI error (${res.status})`, {
          status: res.status,
          body: errText,
        });
      }

      return res.json();
    };

    let raw;
    try {
      raw = await withRetry(
        () => withTimeout(requestFn(), config.defaults.requestTimeoutMs, 'Cloudflare generateImage'),
        {
          retries: 1,
          shouldRetry: (err) => !(err instanceof ProviderError) || err.details?.status >= 500,
        }
      );
    } catch (err) {
      logger.error('Cloudflare image provider request failed', { err });
      if (err instanceof ProviderError) throw err;
      throw new ProviderError('Failed to reach Cloudflare Workers AI', null, err);
    }

    // Workers AI image models return { result: { image: "<base64 png>" } }
    // when called via the REST API (as opposed to a raw binary stream).
    const base64 = raw?.result?.image;
    if (!base64) {
      throw new ProviderError('Cloudflare Workers AI returned no image data', { raw });
    }

    return {
      provider: this.name,
      base64,
      mimeType: 'image/png',
    };
  }
}

module.exports = CloudflareImageProvider;
