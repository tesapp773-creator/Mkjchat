'use strict';

/**
 * MKJ AI Core - Base Provider
 * -----------------------------------------------------------------------
 * Every concrete provider (Gemini, OpenRouter, future providers) MUST
 * implement this interface. Services depend only on this shape - never
 * on a specific provider's SDK/response format. This is what keeps
 * provider-specific logic from leaking into services (Dependency
 * Inversion Principle).
 *
 * A provider is responsible for:
 *   1. Talking to its own API (auth headers, endpoint URLs, payload shape).
 *   2. Translating its raw response into the AI Core's normalized shape.
 *   3. Translating its own errors into AppError subclasses (ProviderError).
 *
 * Normalized chat completion result shape:
 * {
 *   provider: string,
 *   model: string,
 *   text: string,
 *   raw: object,          // original provider response, for debugging only
 *   usage: { promptTokens: number|null, completionTokens: number|null, totalTokens: number|null }
 * }
 */
class BaseProvider {
  /**
   * @param {string} name - Provider identifier (see constants.PROVIDERS).
   */
  constructor(name) {
    if (new.target === BaseProvider) {
      throw new Error('BaseProvider is abstract and cannot be instantiated directly.');
    }
    this.name = name;
  }

  /**
   * Whether this provider is currently usable (has credentials configured).
   * @returns {boolean}
   */
  // eslint-disable-next-line class-methods-use-this
  isAvailable() {
    throw new Error('isAvailable() must be implemented by provider.');
  }

  /**
   * Generate a chat completion.
   * @param {object} params
   * @param {Array<{role: string, content: string}>} params.messages - Normalized message history, oldest first.
   * @param {string} [params.model] - Provider-specific model override.
   * @param {number} [params.temperature]
   * @param {number} [params.maxOutputTokens]
   * @param {string} [params.systemPrompt] - System / instruction prompt.
   * @returns {Promise<object>} Normalized chat completion result.
   */
  // eslint-disable-next-line class-methods-use-this
  async chatComplete(_params) {
    throw new Error('chatComplete() must be implemented by provider.');
  }

  /**
   * Optional: stream a chat completion. Providers that don't support
   * streaming may omit this - callers must feature-detect via
   * `typeof provider.chatCompleteStream === 'function'`.
   * @param {object} params - Same shape as chatComplete().
   * @param {(chunk: string) => void} onChunk
   * @returns {Promise<object>} Final normalized result once streaming completes.
   */
  async chatCompleteStream(_params, _onChunk) {
    throw new Error(`${this.name} provider does not support streaming.`);
  }
}

module.exports = BaseProvider;
