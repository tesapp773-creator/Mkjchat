'use strict';

const BaseProvider = require('./base.provider');
const { config, requireProviderConfig } = require('../config');
const { PROVIDERS, ROLES } = require('../constants');
const { ProviderError } = require('../errors/AppError');
const { withTimeout, withRetry } = require('../utils/async');
const logger = require('../utils/logger');

/**
 * Gemini provider (Google Generative Language API).
 *
 * IMPORTANT: This is a NEW, isolated client for the AI Core. It does
 * NOT touch, import, or modify any existing Gemini integration used by
 * the current translation/chat backend. It reads GEMINI_API_KEY from
 * config.js the same way, but is a fully independent code path.
 */
class GeminiProvider extends BaseProvider {
  constructor() {
    super(PROVIDERS.GEMINI);
  }

  isAvailable() {
    return Boolean(config.providers.gemini.apiKey);
  }

  /**
   * Maps our normalized role names to Gemini's role names.
   * Gemini has no "system" role in `contents` - system prompts go in
   * `systemInstruction` instead.
   */
  // eslint-disable-next-line class-methods-use-this
  _mapRole(role) {
    if (role === ROLES.ASSISTANT) return 'model';
    return 'user';
  }

  /**
   * @param {object} params
   * @param {Array} [params.tools] - Optional Gemini function-calling tool
   *   declarations. When provided, Gemini may respond with a functionCall
   *   part instead of (or alongside) text, letting the model decide when
   *   a request needs a tool - e.g. image generation - based on the
   *   natural language of the message, not keyword matching.
   * @returns {Promise<object>} Normalized result (see BaseProvider docs).
   */
  async chatComplete(params) {
    const providerConfig = requireProviderConfig(PROVIDERS.GEMINI);
    const {
      messages = [],
      model = providerConfig.defaultModel,
      temperature = 0.7,
      maxOutputTokens = 2048,
      systemPrompt = null,
      tools = null,
    } = params;

    const contents = messages
      .filter((m) => m.role !== ROLES.SYSTEM)
      .map((m) => ({
        role: this._mapRole(m.role),
        parts: [{ text: m.content }],
      }));

    const body = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens,
      },
    };

    if (systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: systemPrompt }],
      };
    }

    if (tools) {
      body.tools = tools;
    }

    const url = `${providerConfig.baseUrl}/models/${model}:generateContent?key=${providerConfig.apiKey}`;

    const requestFn = async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new ProviderError(`Gemini API error (${res.status})`, {
          status: res.status,
          body: errText,
        });
      }

      return res.json();
    };

    let raw;
    try {
      raw = await withRetry(
        () => withTimeout(requestFn(), config.defaults.requestTimeoutMs, 'Gemini chatComplete'),
        {
          retries: 1,
          shouldRetry: (err) => !(err instanceof ProviderError) || err.details?.status >= 500,
        }
      );
    } catch (err) {
      logger.error('Gemini provider request failed', { err, model });
      if (err instanceof ProviderError) throw err;
      throw new ProviderError('Failed to reach Gemini API', null, err);
    }

    const text = this._extractText(raw);
    const usage = this._extractUsage(raw);
    const functionCall = this._extractFunctionCall(raw);

    return {
      provider: this.name,
      model,
      text,
      functionCall,
      raw,
      usage,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  _extractText(raw) {
    try {
      const candidate = raw.candidates && raw.candidates[0];
      const parts = candidate && candidate.content && candidate.content.parts;
      if (!parts) return '';
      return parts.map((p) => p.text || '').join('');
    } catch (_err) {
      return '';
    }
  }

  /**
   * Vision: answer a question about an image. Kept as a SEPARATE method
   * from chatComplete (rather than overloading it with image parts) so
   * this new feature cannot regress the existing, already-working text
   * chat path - same isolation principle as image.service.js being
   * separate from chat.service.js.
   * @param {object} params
   * @param {string} params.imageBase64 - Base64-encoded image data (no data: prefix).
   * @param {string} params.mimeType - e.g. 'image/jpeg', 'image/png'.
   * @param {string} params.question - What the user asked about the image.
   * @param {string} [params.systemPrompt]
   * @returns {Promise<{provider: string, model: string, text: string}>}
   */
  async describeImage(params) {
    const providerConfig = requireProviderConfig(PROVIDERS.GEMINI);
    const { imageBase64, mimeType, question, systemPrompt = null } = params;
    const model = providerConfig.defaultModel;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: question }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 800,
      },
    };

    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const url = `${providerConfig.baseUrl}/models/${model}:generateContent?key=${providerConfig.apiKey}`;

    const requestFn = async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new ProviderError(`Gemini vision API error (${res.status})`, {
          status: res.status,
          body: errText,
        });
      }

      return res.json();
    };

    let raw;
    try {
      raw = await withRetry(
        () => withTimeout(requestFn(), config.defaults.requestTimeoutMs, 'Gemini describeImage'),
        {
          retries: 1,
          shouldRetry: (err) => !(err instanceof ProviderError) || err.details?.status >= 500,
        }
      );
    } catch (err) {
      logger.error('Gemini vision request failed', { err, model });
      if (err instanceof ProviderError) throw err;
      throw new ProviderError('Failed to reach Gemini vision API', null, err);
    }

    return {
      provider: this.name,
      model,
      text: this._extractText(raw),
    };
  }

  /**
   * Extract a function call from Gemini's response, if the model chose
   * to invoke a tool instead of (or alongside) replying with text.
   * @returns {{name: string, args: object}|null}
   */
  // eslint-disable-next-line class-methods-use-this
  _extractFunctionCall(raw) {
    try {
      const candidate = raw.candidates && raw.candidates[0];
      const parts = candidate && candidate.content && candidate.content.parts;
      if (!parts) return null;
      const callPart = parts.find((p) => p.functionCall);
      if (!callPart) return null;
      return {
        name: callPart.functionCall.name,
        args: callPart.functionCall.args || {},
      };
    } catch (_err) {
      return null;
    }
  }

  // eslint-disable-next-line class-methods-use-this
  _extractUsage(raw) {
    const usage = raw && raw.usageMetadata;
    if (!usage) {
      return { promptTokens: null, completionTokens: null, totalTokens: null };
    }
    return {
      promptTokens: usage.promptTokenCount ?? null,
      completionTokens: usage.candidatesTokenCount ?? null,
      totalTokens: usage.totalTokenCount ?? null,
    };
  }
}

module.exports = GeminiProvider;
