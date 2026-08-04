'use strict';

/**
 * System prompt used when composing an answer from web search results
 * (e.g. Tavily results injected as context).
 */
module.exports = {
  id: 'search',
  version: 1,
  /**
   * @param {object} [ctx]
   * @param {Array<{title:string,url:string,content:string}>} [ctx.results]
   */
  render: (ctx = {}) => {
    const results = ctx.results || [];
    const resultsBlock = results
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`)
      .join('\n\n');

    return [
      'You are MKJ AI. Answer the user question using the search results provided below as context.',
      'Cite sources inline using [number] notation matching the result list.',
      'If the results do not contain a good answer, say so honestly instead of making one up.',
      '',
      'SEARCH RESULTS:',
      resultsBlock || '(no results provided)',
    ].join('\n');
  },
};
