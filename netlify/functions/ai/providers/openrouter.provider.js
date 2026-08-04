'use strict';

const BaseProvider = require('./base.provider');
const { config, requireProviderConfig } = require('../config');
const { PROVIDERS, ROLES } = require('../constants');
const { ProviderError } = require('../errors/AppError');
const { withTimeout, withRetry } = require('../utils/async');
const logger = require('../utils/logger');

/**
 * OpenRouter provider - OpenAI-compatible chat completions API that
 * proxies many underlying models. Useful as a fallback / alternate
 * provider when Gemini is unavailable or a different model is desired.
 */
class OpenRouterProvider extends BaseProvider {
  constructor() {
    super(PROVIDERS.OPENROUTER);
  }

  isAvailable() {
    return Boolean(config.providers.openrouter.apiKey);
  }

  async chatComplete(params) {
    const providerConfig = requireProviderConfig(PROVIDERS.OPENROUTER);
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

    const body = {
      model,
      messages: chatMessages,
      temperature,
      max_tokens: maxOutputTokens,
    };

    const requestFn = async () => {
      const res = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${providerConfig.apiKey}`,
          'HTTP-Referer': providerConfig.appUrl,
          'X-Title': providerConfig.appName,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new ProviderError(`OpenRouter API error (${res.status})`, {
          status: res.status,
          body: errText,
        });
      }

      return res.json();
    };

    let raw;
    try {
      raw = await withRetry(
        () => withTimeout(requestFn(), config.defaults.requestTimeoutMs, 'OpenRouter chatComplete'),
        {
          retries: 1,
          shouldRetry: (err) => !(err instanceof ProviderError) || err.details?.status >= 500,
        }
      );
    } catch (err) {
      logger.error('OpenRouter provider request failed', { err, model });
      if (err instanceof ProviderError) throw err;
      throw new ProviderError('Failed to reach OpenRouter API', null, err);
    }

    const text = this._extractText(raw);
    const usage = this._extractUsage(raw);

    return {
      provider: this.name,
      model,
      text,
      raw,
      usage,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  _extractText(raw) {
    try {
      return raw.choices?.[0]?.message?.content || '';
    } catch (_err) {
      return '';
    }
  }

  // eslint-disable-next-line class-methods-use-this
  _extractUsage(raw) {
    const usage = raw && raw.usage;
    if (!usage) {
      return { promptTokens: null, completionTokens: null, totalTokens: null };
    }
    return {
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
      totalTokens: usage.total_tokens ?? null,
    };
  }
}

module.exports = OpenRouterProvider;
