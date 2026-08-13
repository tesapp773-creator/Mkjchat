'use strict';

const GeminiProvider = require('./gemini.provider');
const CloudflareChatProvider = require('./cloudflare-chat.provider');
const OpenRouterProvider = require('./openrouter.provider');
const { PROVIDERS } = require('../constants');
const { config } = require('../config');
const { ProviderUnavailableError } = require('../errors/AppError');
const logger = require('../utils/logger');

/**
 * MKJ AI Core - Provider Manager
 * -----------------------------------------------------------------------
 * Single point of truth for "which provider instance do I use". Services
 * NEVER instantiate providers directly and never branch on provider name
 * for business logic - they ask the manager for a provider by name or
 * let it pick a default, then call the BaseProvider interface.
 *
 * Adding a new provider (e.g. Anthropic, Mistral, local model) means:
 *   1. Create providers/<name>.provider.js implementing BaseProvider.
 *   2. Register it in the `registry` map below.
 *   3. Nothing else in the codebase changes.
 *
 * REGISTRATION ORDER MATTERS: getFallbackProvider() below walks this map
 * in insertion order and returns the first available match. Cloudflare
 * is registered before OpenRouter so it's tried first as the chat
 * fallback - it reuses the same Cloudflare account already set up for
 * image generation, rather than depending on OpenRouter's separate
 * account/credit-balance state.
 */

const registry = new Map([
  [PROVIDERS.GEMINI, new GeminiProvider()],
  [PROVIDERS.CLOUDFLARE, new CloudflareChatProvider()],
  [PROVIDERS.OPENROUTER, new OpenRouterProvider()],
]);

/**
 * Get a provider instance by name.
 * @param {string} name
 * @returns {import('./base.provider')}
 */
function getProvider(name) {
  const provider = registry.get(name);
  if (!provider) {
    throw new ProviderUnavailableError(`Unknown provider: ${name}`);
  }
  return provider;
}

/**
 * Get the configured default provider for chat, falling back to any
 * available provider if the default isn't configured.
 * @returns {import('./base.provider')}
 */
function getDefaultProvider() {
  const preferred = config.defaults.chatProvider;
  const provider = registry.get(preferred);
  if (provider && provider.isAvailable()) {
    return provider;
  }

  logger.warn('Preferred default provider unavailable, searching for fallback', {
    preferred,
  });

  for (const candidate of registry.values()) {
    if (candidate.isAvailable()) {
      return candidate;
    }
  }

  throw new ProviderUnavailableError('No AI provider is currently configured/available.');
}

/**
 * Resolve a provider: explicit name takes priority, otherwise default.
 * @param {string} [name]
 * @returns {import('./base.provider')}
 */
function resolveProvider(name) {
  if (name) return getProvider(name);
  return getDefaultProvider();
}

/**
 * Get the next available provider other than the one that just failed.
 * Used for automatic runtime fallback (e.g. Gemini hit a rate limit mid
 * -request) - distinct from getDefaultProvider(), which only checks
 * config at selection time, before any request has been attempted.
 * @param {string} excludeName - Name of the provider that just failed.
 * @returns {import('./base.provider')|null} A fallback provider, or null if none available.
 */
function getFallbackProvider(excludeName) {
  for (const [name, candidate] of registry.entries()) {
    if (name !== excludeName && candidate.isAvailable()) {
      return candidate;
    }
  }
  return null;
}

/**
 * Get EVERY remaining available provider, in registry order, excluding
 * whichever ones have already been tried. Added 2026-08-13: a single
 * fallback (getFallbackProvider above) isn't enough resilience on its
 * own - if Gemini fails AND its one fallback also fails, chat should
 * still try whatever else is registered (e.g. OpenRouter) before truly
 * giving up. Used to build a full retry chain, not just one backup.
 * @param {string[]} excludeNames - Names already attempted.
 * @returns {Array<import('./base.provider')>}
 */
function getFallbackChain(excludeNames) {
  const excluded = new Set(excludeNames);
  const chain = [];
  for (const [name, candidate] of registry.entries()) {
    if (!excluded.has(name) && candidate.isAvailable()) {
      chain.push(candidate);
    }
  }
  return chain;
}

/**
 * List all registered providers and their availability - for health checks.
 * @returns {Array<{name: string, available: boolean}>}
 */
function listProviders() {
  return Array.from(registry.entries()).map(([name, provider]) => ({
    name,
    available: provider.isAvailable(),
  }));
}

/**
 * Register a new provider at runtime (used by tests or future dynamic
 * provider loading). Not required for normal operation.
 * @param {string} name
 * @param {import('./base.provider')} providerInstance
 */
function registerProvider(name, providerInstance) {
  registry.set(name, providerInstance);
}

module.exports = {
  getProvider,
  getDefaultProvider,
  getFallbackProvider,
  getFallbackChain,
  resolveProvider,
  listProviders,
  registerProvider,
};
