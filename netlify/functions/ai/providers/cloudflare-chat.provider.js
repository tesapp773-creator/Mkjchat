'use strict';

const BaseProvider = require('./base.provider');
const { config, requireCloudflareChatConfig } = require('../config');
const { PROVIDERS, ROLES } = require('../constants');
const { ProviderError } = require('../errors/AppError');
const { withTimeout, withRetry } = require('../utils/async');
const logger = require('../utils/logger');

/**
 * Cloudflare Workers AI - chat/text provider (Llama 3.1 8B by default).
 * Used as the chat fallback: when Gemini is rate-limited or unavailable,
 * this is tried before OpenRouter, since it reuses the SAME Cloudflare
 * account already set up for image generation - no separate billing
 * state to go wrong, unlike OpenRouter's credit-balance requirement.
 */
class CloudflareChatProvider extends BaseProvider {
  constructor() {
    super(PROVIDERS.CLOUDFLARE);
  }

  isAvailable() {
    return Boolean(config.providers.cloudflare.apiKey && config.providers.cloudflare.accountId);
  }

  async chatComplete(params) {
    const providerConfig = requireCloudflareChatConfig();
    const {
      messages = [],
      model = providerConfig.defaultModel,
      temperature = 0.7,
      maxOutputTokens = 2048,
      systemPrompt = null,
    } = params;

    const chatMessages = [];
    if (systemPrompt) {
      chatMessages.push({ role: ROLES.SYSTEM, content: systemPrompt });
    }
    for (const m of messages) {
      chatMessages.push({ role: m.role, content: m.content });
    }

    const url = `${providerConfig.baseUrl}/${providerConfig.accountId}/ai/run/${model}`;

    const requestFn = async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${providerConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatMessages,
          temperature,
          max_tokens: maxOutputTokens,
        }),
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
        () => withTimeout(requestFn(), config.defaults.requestTimeoutMs, 'Cloudflare chatComplete'),
        {
          retries: 1,
          shouldRetry: (err) => !(err instanceof ProviderError) || err.details?.status >= 500,
        }
      );
    } catch (err) {
      logger.error('Cloudflare chat provider request failed', { err, model });
      if (err instanceof ProviderError) throw err;
      throw new ProviderError('Failed to reach Cloudflare Workers AI', null, err);
    }

    const text = this._extractText(raw);

    return {
      provider: this.name,
      model,
      text,
      raw,
      usage: { promptTokens: null, completionTokens: null, totalTokens: null },
    };
  }

  // eslint-disable-next-line class-methods-use-this
  _extractText(raw) {
    // Workers AI text models return { result: { response: "<text>" } }.
    try {
      return raw?.result?.response || '';
    } catch (_err) {
      return '';
    }
  }
}

module.exports = CloudflareChatProvider;
