'use strict';

const { requireSearchConfig } = require('../config');
const { requireString } = require('../utils/validate');
const { withTimeout, withRetry } = require('../utils/async');
const { ProviderError } = require('../errors/AppError');
const { config } = require('../config');
const logger = require('../utils/logger');

/**
 * MKJ AI Core - Search Service
 * -----------------------------------------------------------------------
 * Wraps the Tavily search API. This service is NEVER called implicitly
 * by chat.service - it is only invoked when a caller explicitly requests
 * the "search" action (see router.js / ACTIONS.SEARCH). This matches the
 * spec: "Do not call it unless requested."
 */

/**
 * Run a web search via Tavily.
 * @param {object} params
 * @param {string} params.query
 * @param {number} [params.maxResults]
 * @param {boolean} [params.includeAnswer=true]
 * @returns {Promise<import('../types').SearchResult>}
 */
async function search(params = {}) {
  const query = requireString(params.query, 'query');
  const tavilyConfig = requireSearchConfig();
  const maxResults = params.maxResults || tavilyConfig.maxResults;
  const includeAnswer = params.includeAnswer !== false;

  const body = {
    api_key: tavilyConfig.apiKey,
    query,
    max_results: maxResults,
    include_answer: includeAnswer,
  };

  const requestFn = async () => {
    const res = await fetch(`${tavilyConfig.baseUrl}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new ProviderError(`Tavily API error (${res.status})`, {
        status: res.status,
        body: errText,
      });
    }

    return res.json();
  };

  let raw;
  try {
    raw = await withRetry(
      () => withTimeout(requestFn(), config.defaults.requestTimeoutMs, 'Tavily search'),
      {
        retries: 1,
        shouldRetry: (err) => !(err instanceof ProviderError) || err.details?.status >= 500,
      }
    );
  } catch (err) {
    logger.error('Search service request failed', { err, query });
    if (err instanceof ProviderError) throw err;
    throw new ProviderError('Failed to reach Tavily search API', null, err);
  }

  const results = Array.isArray(raw.results)
    ? raw.results.map((r) => ({
        title: r.title || '',
        url: r.url || '',
        content: r.content || '',
        score: typeof r.score === 'number' ? r.score : undefined,
      }))
    : [];

  return {
    query,
    results,
    answer: raw.answer || undefined,
  };
}

module.exports = {
  search,
};
